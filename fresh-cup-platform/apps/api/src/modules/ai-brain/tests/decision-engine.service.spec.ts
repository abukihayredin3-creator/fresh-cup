import { AiPriority } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../interfaces/ai-brain.interfaces";
import { DecisionEngineService } from "../services/decision-engine.service";
import { PredictionEngineService } from "../services/prediction-engine.service";
import { ReasoningEngineService } from "../services/reasoning-engine.service";
import { RecommendationEngineService } from "../services/recommendation-engine.service";

function stableSalesInsight(currentRevenue = 700): {
  content: ReasoningResult;
  confidence: number;
} {
  const content: ReasoningResult = {
    category: "sales",
    problem: "No significant revenue anomaly detected in the last 7 days",
    causes: [],
    confidence: 0.8,
    evidence: [],
    signals: {
      kind: "sales",
      trend: {
        currentRevenue,
        previousRevenue: currentRevenue,
        revenueChangePct: 0,
        currentOrderCount: 10,
        previousOrderCount: 10,
        orderChangePct: 0,
      },
    },
  };
  return { content, confidence: content.confidence };
}

describe("DecisionEngineService", () => {
  let service: DecisionEngineService;
  let prisma: { aiDecision: { create: jest.Mock } };
  let reasoning: { analyze: jest.Mock };
  let prediction: { predict: jest.Mock };
  let recommendation: { generate: jest.Mock };

  beforeEach(() => {
    prisma = {
      aiDecision: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "dec-1", ...data })),
      },
    };
    reasoning = { analyze: jest.fn().mockResolvedValue(stableSalesInsight()) };
    prediction = {
      predict: jest
        .fn()
        .mockResolvedValue({ metric: "sales", forecast: 100, confidence: 0.7, period: "tomorrow" }),
    };
    recommendation = { generate: jest.fn().mockResolvedValue([]) };

    service = new DecisionEngineService(
      prisma as unknown as PrismaService,
      reasoning as unknown as ReasoningEngineService,
      prediction as unknown as PredictionEngineService,
      recommendation as unknown as RecommendationEngineService,
    );
  });

  it("returns no decisions when there are no recommendations and no demand swing", async () => {
    const result = await service.decide("org-1", "branch-1");

    expect(result).toEqual([]);
    expect(prisma.aiDecision.create).not.toHaveBeenCalled();
  });

  it("turns each recommendation into a RECOMMENDATION_ACTION decision", async () => {
    recommendation.generate.mockResolvedValue([
      {
        title: "Reorder Avocado",
        description: "Low stock",
        confidence: 0.7,
        priority: AiPriority.HIGH,
      },
    ]);

    const result = await service.decide("org-1", "branch-1");

    expect(result).toHaveLength(1);
    const data = prisma.aiDecision.create.mock.calls[0][0].data;
    expect(data.decisionType).toBe("RECOMMENDATION_ACTION");
    expect(data.priority).toBe(AiPriority.HIGH);
    expect(data.output.action).toBe("Reorder Avocado");
    expect(data.organizationId).toBe("org-1");
  });

  it("flags a rising demand-forecast decision when the forecast beats the trailing average", async () => {
    reasoning.analyze.mockResolvedValue(stableSalesInsight(700)); // avg/day = 100
    prediction.predict.mockResolvedValue({
      metric: "sales",
      forecast: 150,
      confidence: 0.8,
      period: "tomorrow",
    }); // +50%

    const result = await service.decide("org-1", "branch-1");

    expect(result).toHaveLength(1);
    const data = prisma.aiDecision.create.mock.calls[0][0].data;
    expect(data.decisionType).toBe("DEMAND_FORECAST");
    expect(data.output.action).toMatch(/increase production/i);
  });

  it("flags a falling demand-forecast decision when the forecast is well below the trailing average", async () => {
    reasoning.analyze.mockResolvedValue(stableSalesInsight(700)); // avg/day = 100
    prediction.predict.mockResolvedValue({
      metric: "sales",
      forecast: 50,
      confidence: 0.8,
      period: "tomorrow",
    }); // -50%

    await service.decide("org-1", "branch-1");

    const data = prisma.aiDecision.create.mock.calls[0][0].data;
    expect(data.output.action).toMatch(/reduce next-day/i);
  });

  it("ranks decisions by priority then confidence, highest first", async () => {
    recommendation.generate.mockResolvedValue([
      { title: "Low priority action", description: "d", confidence: 0.4, priority: AiPriority.LOW },
      {
        title: "Critical action",
        description: "d",
        confidence: 0.9,
        priority: AiPriority.CRITICAL,
      },
      { title: "Medium action", description: "d", confidence: 0.6, priority: AiPriority.MEDIUM },
    ]);

    const results = await service.decide("org-1", "branch-1");

    expect(results.map((r) => r.priority)).toEqual([
      AiPriority.CRITICAL,
      AiPriority.MEDIUM,
      AiPriority.LOW,
    ]);
  });

  it("does not persist a decision when the demand swing is below the threshold", async () => {
    reasoning.analyze.mockResolvedValue(stableSalesInsight(700)); // avg/day = 100
    prediction.predict.mockResolvedValue({
      metric: "sales",
      forecast: 105,
      confidence: 0.8,
      period: "tomorrow",
    }); // +5%

    const result = await service.decide("org-1", "branch-1");

    expect(result).toEqual([]);
  });
});
