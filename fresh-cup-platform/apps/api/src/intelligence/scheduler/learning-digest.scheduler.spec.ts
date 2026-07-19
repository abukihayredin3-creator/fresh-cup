import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { PrismaService } from "../../database/prisma.service";
import type { ExecutiveService } from "../../modules/intelligence/executive/executive.service";
import type { AiMemoryService } from "../memory/ai-memory.service";
import type { ExplanationService } from "../services/explanation.service";
import { LearningDigestScheduler } from "./learning-digest.scheduler";

describe("LearningDigestScheduler", () => {
  function makeScheduler(enabled: boolean, branches: { id: string }[] = []) {
    const prisma = {
      branch: { findMany: jest.fn().mockResolvedValue(branches) },
    } as unknown as jest.Mocked<PrismaService>;
    const executiveService = {
      overview: jest.fn().mockResolvedValue({
        totalRevenue: 100000,
        totalEstimatedProfit: 20000,
        repeatCustomerRate: 0.3,
        conversionMetrics: { ordersPlaced: 42 },
      }),
    } as unknown as jest.Mocked<ExecutiveService>;
    const explanation = {
      explain: jest.fn().mockResolvedValue("digest text"),
    } as unknown as jest.Mocked<ExplanationService>;
    const memory = {
      rememberLearningDigest: jest.fn().mockResolvedValue("mem-1"),
    } as unknown as jest.Mocked<AiMemoryService>;
    const config = { get: () => enabled } as unknown as ConfigService<EnvironmentVariables, true>;

    const scheduler = new LearningDigestScheduler(
      config,
      prisma,
      executiveService,
      explanation,
      memory,
    );
    return { scheduler, prisma, executiveService, explanation, memory };
  }

  it("does nothing when AI_EXECUTIVE_ENABLED is false", async () => {
    const { scheduler, prisma } = makeScheduler(false);
    await scheduler.run("weekly");
    expect(prisma.branch.findMany).not.toHaveBeenCalled();
  });

  it("writes a learning digest per active branch plus the all-branches aggregate", async () => {
    const { scheduler, memory } = makeScheduler(true, [{ id: "b1" }, { id: "b2" }]);
    await scheduler.run("monthly");
    expect(memory.rememberLearningDigest).toHaveBeenCalledTimes(3);
    expect(memory.rememberLearningDigest).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "b1", domain: "executive" }),
    );
  });

  it("continues to remaining branches if one branch's overview throws", async () => {
    const { scheduler, executiveService, memory } = makeScheduler(true, [
      { id: "b1" },
      { id: "b2" },
    ]);
    executiveService.overview.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({
      totalRevenue: 0,
      totalEstimatedProfit: 0,
      repeatCustomerRate: 0,
      conversionMetrics: { ordersPlaced: 0 },
    } as never);

    await expect(scheduler.run("seasonal")).resolves.toBeUndefined();
    expect(memory.rememberLearningDigest).toHaveBeenCalledTimes(2);
  });

  it.each(["weekly", "monthly", "seasonal", "yearly"] as const)(
    "runWeekly/runMonthly/runSeasonal/runYearly delegate to run('%s')",
    async (period) => {
      const { scheduler } = makeScheduler(true, []);
      const spy = jest.spyOn(scheduler, "run");
      const methodName = `run${period[0]!.toUpperCase()}${period.slice(1)}` as
        "runWeekly" | "runMonthly" | "runSeasonal" | "runYearly";
      await scheduler[methodName]();
      expect(spy).toHaveBeenCalledWith(period);
    },
  );
});
