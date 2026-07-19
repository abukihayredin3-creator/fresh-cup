import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../common/config/env.validation";
import type { PrismaService } from "../../database/prisma.service";
import type { ExecutiveAiService } from "../services/executive-ai/executive-ai.service";
import type { EmbeddingBackfillWorker } from "../workers/embedding-backfill.worker";
import type { KnowledgeBaseIndexWorker } from "../workers/knowledge-base-index.worker";
import { AiDailyDigestScheduler } from "./ai-daily-digest.scheduler";

describe("AiDailyDigestScheduler", () => {
  function makeScheduler(enabled: boolean, branches: { id: string }[] = []) {
    const prisma = {
      branch: { findMany: jest.fn().mockResolvedValue(branches) },
    } as unknown as jest.Mocked<PrismaService>;
    const executiveAi = {
      dailySummary: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ExecutiveAiService>;
    const embeddingBackfill = {
      run: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<EmbeddingBackfillWorker>;
    const knowledgeBaseIndex = {
      run: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<KnowledgeBaseIndexWorker>;
    const config = { get: () => enabled } as unknown as ConfigService<EnvironmentVariables, true>;

    const scheduler = new AiDailyDigestScheduler(
      config,
      prisma,
      executiveAi,
      embeddingBackfill,
      knowledgeBaseIndex,
    );
    return { scheduler, prisma, executiveAi, embeddingBackfill, knowledgeBaseIndex };
  }

  it("does nothing when AI_EXECUTIVE_ENABLED is false", async () => {
    const { scheduler, prisma } = makeScheduler(false);
    await scheduler.run();
    expect(prisma.branch.findMany).not.toHaveBeenCalled();
  });

  it("summarizes every active branch plus the all-branches aggregate, and runs both backfill workers", async () => {
    const { scheduler, executiveAi, embeddingBackfill, knowledgeBaseIndex } = makeScheduler(true, [
      { id: "b1" },
      { id: "b2" },
    ]);
    await scheduler.run();

    expect(executiveAi.dailySummary).toHaveBeenCalledTimes(3); // b1, b2, and the undefined aggregate
    expect(executiveAi.dailySummary).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" }),
      "b1",
    );
    expect(executiveAi.dailySummary).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" }),
      "b2",
    );
    expect(executiveAi.dailySummary).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN" }),
      undefined,
    );
    expect(embeddingBackfill.run).toHaveBeenCalled();
    expect(knowledgeBaseIndex.run).toHaveBeenCalled();
  });

  it("continues to remaining branches if one branch's summary throws", async () => {
    const { scheduler, executiveAi } = makeScheduler(true, [{ id: "b1" }, { id: "b2" }]);
    executiveAi.dailySummary
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({} as never);

    await expect(scheduler.run()).resolves.toBeUndefined();
    expect(executiveAi.dailySummary).toHaveBeenCalledTimes(3);
  });
});
