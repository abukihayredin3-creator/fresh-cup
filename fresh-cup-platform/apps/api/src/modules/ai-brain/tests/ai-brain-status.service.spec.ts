import type { PrismaService } from "../../../database/prisma.service";
import { AiBrainStatusService } from "../services/ai-brain-status.service";
import { PredictionEngineService } from "../services/prediction-engine.service";

describe("AiBrainStatusService", () => {
  it("aggregates counts scoped to the organization and reports the active prediction provider", async () => {
    const prisma = {
      aiInsight: { count: jest.fn().mockResolvedValue(3) },
      aiMemory: { count: jest.fn().mockResolvedValue(5) },
      aiRecommendation: { count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(2) },
      aiDecision: { count: jest.fn().mockResolvedValue(1) },
    };
    const prediction = { name: "statistical-trend-v1" };

    const service = new AiBrainStatusService(
      prisma as unknown as PrismaService,
      prediction as unknown as PredictionEngineService,
    );

    const status = await service.getStatus("org-1");

    expect(status.organizationId).toBe("org-1");
    expect(status.insightCount).toBe(3);
    expect(status.memoryCount).toBe(5);
    expect(status.recommendationCount).toBe(4);
    expect(status.pendingRecommendationCount).toBe(2);
    expect(status.decisionCount).toBe(1);
    expect(status.predictionProvider).toBe("statistical-trend-v1");
    expect(prisma.aiInsight.count).toHaveBeenCalledWith({ where: { organizationId: "org-1" } });
  });
});
