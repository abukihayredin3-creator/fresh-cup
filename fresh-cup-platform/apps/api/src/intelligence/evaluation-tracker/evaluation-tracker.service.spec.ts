import { RecommendationOutcomeStatus } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { EvaluationTrackerService } from "./evaluation-tracker.service";

describe("EvaluationTrackerService", () => {
  function makeService() {
    const prisma = {
      aiEvaluationRecord: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "rec-1", ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      aiRecommendationOutcome: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "out-1", ...data })),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "out-1", ...data })),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const service = new EvaluationTrackerService(prisma);
    return { service, prisma };
  }

  it("record() writes a metric measurement", async () => {
    const { service, prisma } = makeService();
    await service.record({ metricName: "precision", value: 0.92, modelKey: "customer-churn" });
    expect(prisma.aiEvaluationRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metricName: "precision", value: 0.92 }),
      }),
    );
  });

  it("trend() fetches recent records for a metric", async () => {
    const { service, prisma } = makeService();
    await service.trend("latency_ms", "sales-revenue", 10);
    expect(prisma.aiEvaluationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { metricName: "latency_ms", modelKey: "sales-revenue" },
        take: 10,
      }),
    );
  });

  it("recordOutcome() creates a PENDING recommendation outcome", async () => {
    const { service, prisma } = makeService();
    await service.recordOutcome({ source: "decision-engine", recommendation: "Launch a coupon" });
    expect(prisma.aiRecommendationOutcome.create).toHaveBeenCalled();
  });

  it("decideOutcome() throws when the outcome doesn't exist", async () => {
    const { service, prisma } = makeService();
    (prisma.aiRecommendationOutcome.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      service.decideOutcome("missing", RecommendationOutcomeStatus.ACCEPTED, "user-1"),
    ).rejects.toThrow("Recommendation outcome not found");
  });

  it("decideOutcome() records the decision", async () => {
    const { service, prisma } = makeService();
    (prisma.aiRecommendationOutcome.findUnique as jest.Mock).mockResolvedValue({ id: "out-1" });
    await service.decideOutcome("out-1", RecommendationOutcomeStatus.ACCEPTED, "user-1", 5000);
    expect(prisma.aiRecommendationOutcome.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RecommendationOutcomeStatus.ACCEPTED,
          decidedByUserId: "user-1",
          actualImpact: 5000,
        }),
      }),
    );
  });

  it("flagHallucination() sets the flag", async () => {
    const { service, prisma } = makeService();
    (prisma.aiRecommendationOutcome.findUnique as jest.Mock).mockResolvedValue({ id: "out-1" });
    await service.flagHallucination("out-1");
    expect(prisma.aiRecommendationOutcome.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { flaggedHallucination: true } }),
    );
  });

  it("acceptanceRate() computes accepted / (accepted + rejected)", async () => {
    const { service, prisma } = makeService();
    (prisma.aiRecommendationOutcome.count as jest.Mock)
      .mockResolvedValueOnce(3) // accepted
      .mockResolvedValueOnce(1); // rejected

    const result = await service.acceptanceRate("decision-engine");
    expect(result).toEqual({ accepted: 3, rejected: 1, rate: 0.75 });
  });

  it("acceptanceRate() returns 0 when nothing has been decided", async () => {
    const { service } = makeService();
    const result = await service.acceptanceRate();
    expect(result.rate).toBe(0);
  });

  it("businessImpact() sums estimated and actual impact of accepted outcomes", async () => {
    const { service, prisma } = makeService();
    (prisma.aiRecommendationOutcome.findMany as jest.Mock).mockResolvedValue([
      { estimatedImpact: 1000, actualImpact: 800 },
      { estimatedImpact: 500, actualImpact: null },
    ]);

    const result = await service.businessImpact();
    expect(result).toEqual({ estimatedTotal: 1500, actualTotal: 800 });
  });
});
