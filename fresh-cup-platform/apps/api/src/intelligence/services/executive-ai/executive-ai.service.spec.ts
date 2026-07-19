import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { ExecutiveService } from "../../../modules/intelligence/executive/executive.service";
import type { MarketingIntelligenceService } from "../../../modules/intelligence/marketing-intelligence/marketing-intelligence.service";
import type { AiMemoryService } from "../../memory/ai-memory.service";
import type { ExplanationService } from "../explanation.service";
import { ExecutiveAiService } from "./executive-ai.service";

const actor: RequestUser = { id: "user-1", role: "MANAGER" as never, branchId: null };

function overview(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    from: "2026-06-01",
    to: "2026-06-30",
    totalRevenue: 500000,
    totalEstimatedProfit: 200000,
    repeatCustomerRate: 0.4,
    revenueTrend: [
      { date: "2026-06-01", revenue: 10000, estimatedProfit: 4000 },
      { date: "2026-06-02", revenue: 12000, estimatedProfit: 4200 },
      { date: "2026-06-03", revenue: 15000, estimatedProfit: 5000 },
      { date: "2026-06-04", revenue: 17000, estimatedProfit: 5500 },
    ],
    productProfitability: [],
    branchComparison: [],
    customerGrowth: [],
    peakHours: [],
    conversionMetrics: { cartsCreated: 50, ordersPlaced: 40, conversionRate: 0.8 },
    inventoryCosts: { purchasingSpend: 100000, wasteCost: 1000 },
    marketingRoi: {
      couponDiscountGiven: 0,
      revenueFromCouponOrders: 0,
      returnPerDiscountBirr: null,
    },
    ...overrides,
  };
}

describe("ExecutiveAiService", () => {
  function makeService(enabled = true) {
    const executiveService = {
      overview: jest.fn().mockResolvedValue(overview()),
    } as unknown as jest.Mocked<ExecutiveService>;
    const marketingIntelligence = {
      targetSuggestions: jest
        .fn()
        .mockResolvedValue([
          {
            segment: "Champions",
            customerCount: 12,
            suggestion: "reward them",
            recommendedChannel: "PUSH",
          },
        ]),
    } as unknown as jest.Mocked<MarketingIntelligenceService>;
    const memory = {
      remember: jest.fn().mockResolvedValue("mem-1"),
    } as unknown as jest.Mocked<AiMemoryService>;
    const explanation = {
      explain: jest
        .fn()
        .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
    } as unknown as jest.Mocked<ExplanationService>;
    const config = { get: () => enabled } as unknown as ConfigService<EnvironmentVariables, true>;

    const service = new ExecutiveAiService(
      config,
      executiveService,
      marketingIntelligence,
      memory,
      explanation,
    );
    return { service, executiveService, marketingIntelligence, memory, explanation };
  }

  it("throws ForbiddenException when AI_EXECUTIVE_ENABLED is false", async () => {
    const { service } = makeService(false);
    await expect(service.dailySummary(actor)).rejects.toThrow(ForbiddenException);
  });

  it("produces a daily summary with explanation, confidence, and a memory entry", async () => {
    const { service, memory } = makeService();
    const result = await service.dailySummary(actor, "branch-1");

    expect(result.title).toBe("Daily summary");
    expect(result.explanation).toContain("Daily summary");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
    expect(result.memoryEntryId).toBe("mem-1");
    expect(memory.remember).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "executive", branchId: "branch-1" }),
    );
  });

  it("detects a revenue decline risk when the trend slopes downward", async () => {
    const { service, executiveService } = makeService();
    executiveService.overview.mockResolvedValue(
      overview({
        revenueTrend: [
          { date: "d1", revenue: 20000, estimatedProfit: 8000 },
          { date: "d2", revenue: 15000, estimatedProfit: 6000 },
          { date: "d3", revenue: 10000, estimatedProfit: 4000 },
          { date: "d4", revenue: 5000, estimatedProfit: 2000 },
        ],
      }) as never,
    );

    const risks = await service.riskDetection(actor);
    expect(risks.some((r) => r.title === "Revenue decline trend")).toBe(true);
  });

  it("flags elevated inventory waste when waste exceeds 5% of purchasing spend", async () => {
    const { service, executiveService } = makeService();
    executiveService.overview.mockResolvedValue(
      overview({ inventoryCosts: { purchasingSpend: 10000, wasteCost: 1000 } }) as never,
    );

    const risks = await service.riskDetection(actor);
    expect(risks.some((r) => r.title === "Elevated inventory waste")).toBe(true);
  });

  it("maps marketing target suggestions into growth-opportunity insights", async () => {
    const { service } = makeService();
    const opportunities = await service.growthOpportunities(actor);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]!.title).toBe("Growth opportunity: Champions");
  });
});
