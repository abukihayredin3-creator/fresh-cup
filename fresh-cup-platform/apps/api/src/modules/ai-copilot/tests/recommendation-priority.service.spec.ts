import { AiPriority, UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DecisionEngineService } from "../../ai-brain/services/decision-engine.service";
import { RecommendationEngineService } from "../../ai-brain/services/recommendation-engine.service";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { InventoryIntelligenceService } from "../../intelligence/inventory-intelligence/inventory-intelligence.service";
import { AiCopilotScopeService } from "../services/ai-copilot-scope.service";
import { RecommendationPriorityService } from "../services/recommendation-priority.service";

const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

function baseOverview(overrides: Record<string, unknown> = {}) {
  return {
    from: "2026-01-01",
    to: "2026-01-08",
    totalRevenue: 1000,
    totalEstimatedProfit: 300,
    repeatCustomerRate: 0.5,
    revenueTrend: [],
    productProfitability: [],
    branchComparison: [],
    customerGrowth: [],
    peakHours: [],
    conversionMetrics: { cartsCreated: 10, ordersPlaced: 5, conversionRate: 0.5 },
    inventoryCosts: { purchasingSpend: 1000, wasteCost: 50 },
    marketingRoi: {
      couponDiscountGiven: 0,
      revenueFromCouponOrders: 0,
      returnPerDiscountBirr: null,
    },
    ...overrides,
  };
}

describe("RecommendationPriorityService", () => {
  let service: RecommendationPriorityService;
  let scope: { resolveBranches: jest.Mock };
  let recommendation: { generate: jest.Mock };
  let decision: { decide: jest.Mock };
  let executive: { overview: jest.Mock };
  let inventoryIntelligence: { intelligence: jest.Mock };

  beforeEach(() => {
    scope = { resolveBranches: jest.fn().mockResolvedValue(["branch-1"]) };
    recommendation = { generate: jest.fn().mockResolvedValue([]) };
    decision = { decide: jest.fn().mockResolvedValue([]) };
    executive = { overview: jest.fn().mockResolvedValue(baseOverview()) };
    inventoryIntelligence = { intelligence: jest.fn().mockResolvedValue([]) };

    service = new RecommendationPriorityService(
      scope as unknown as AiCopilotScopeService,
      recommendation as unknown as RecommendationEngineService,
      decision as unknown as DecisionEngineService,
      executive as unknown as ExecutiveService,
      inventoryIntelligence as unknown as InventoryIntelligenceService,
    );
  });

  it("sorts merged recommendations by priority then confidence", async () => {
    recommendation.generate.mockResolvedValue([
      { title: "low", description: "d", impact: "i", confidence: 0.9, priority: AiPriority.LOW },
      {
        title: "critical",
        description: "d",
        impact: "i",
        confidence: 0.5,
        priority: AiPriority.CRITICAL,
      },
      {
        title: "high-a",
        description: "d",
        impact: "i",
        confidence: 0.6,
        priority: AiPriority.HIGH,
      },
      {
        title: "high-b",
        description: "d",
        impact: "i",
        confidence: 0.9,
        priority: AiPriority.HIGH,
      },
    ]);

    const result = await service.rank(admin, "org-1", "branch-1");

    expect(result.map((r) => r.title)).toEqual(["critical", "high-b", "high-a", "low"]);
  });

  it("includes only DEMAND_FORECAST decisions, not RECOMMENDATION_ACTION duplicates", async () => {
    decision.decide.mockResolvedValue([
      {
        decisionType: "RECOMMENDATION_ACTION",
        priority: AiPriority.HIGH,
        confidence: 0.8,
        output: { action: "Reorder Avocado", reason: "Low stock" },
      },
      {
        decisionType: "DEMAND_FORECAST",
        priority: AiPriority.HIGH,
        confidence: 0.8,
        output: { action: "Increase production", reason: "Demand predicted to rise 30%" },
      },
    ]);

    const result = await service.rank(admin, "org-1", "branch-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe("forecast");
    expect(result[0]!.title).toBe("Increase production");
  });

  it("flags a low marketing ROI as an executive-analytics recommendation", async () => {
    executive.overview.mockResolvedValue(
      baseOverview({
        marketingRoi: {
          couponDiscountGiven: 100,
          revenueFromCouponOrders: 120,
          returnPerDiscountBirr: 1.2,
        },
      }),
    );

    const result = await service.rank(admin, "org-1", "branch-1");

    expect(result.some((r) => r.source === "executive-analytics" && r.title.match(/coupon/i))).toBe(
      true,
    );
  });

  it("flags high waste cost relative to purchasing spend", async () => {
    executive.overview.mockResolvedValue(
      baseOverview({ inventoryCosts: { purchasingSpend: 1000, wasteCost: 300 } }),
    );

    const result = await service.rank(admin, "org-1", "branch-1");

    expect(result.some((r) => r.source === "executive-analytics" && r.title.match(/waste/i))).toBe(
      true,
    );
  });

  it("does not flag waste when it is a small fraction of purchasing spend", async () => {
    executive.overview.mockResolvedValue(
      baseOverview({ inventoryCosts: { purchasingSpend: 1000, wasteCost: 50 } }),
    );

    const result = await service.rank(admin, "org-1", "branch-1");

    expect(result.some((r) => r.source === "executive-analytics" && r.title.match(/waste/i))).toBe(
      false,
    );
  });

  it("turns flagged inventory items into ranked reorder recommendations, capped at 3", async () => {
    inventoryIntelligence.intelligence.mockResolvedValue([
      {
        name: "A",
        suggestedReorderQuantity: 5,
        suggestedReorderCost: 100,
        wasteProbability: 0,
        daysUntilStockout: 5,
      },
      {
        name: "B",
        suggestedReorderQuantity: 5,
        suggestedReorderCost: 100,
        wasteProbability: 0,
        daysUntilStockout: 1,
      },
      {
        name: "C",
        suggestedReorderQuantity: 5,
        suggestedReorderCost: 100,
        wasteProbability: 0,
        daysUntilStockout: 3,
      },
      {
        name: "D",
        suggestedReorderQuantity: 5,
        suggestedReorderCost: 100,
        wasteProbability: 0,
        daysUntilStockout: 10,
      },
      {
        name: "E",
        suggestedReorderQuantity: 0,
        suggestedReorderCost: 0,
        wasteProbability: 0,
        daysUntilStockout: null,
      },
    ]);

    const result = await service.rank(admin, "org-1", "branch-1");

    const inventoryRecs = result.filter((r) => r.source === "inventory");
    expect(inventoryRecs).toHaveLength(3);
    expect(inventoryRecs[0]!.title).toBe("Reorder B"); // most urgent (1 day) first
    expect(inventoryRecs[0]!.priority).toBe(AiPriority.CRITICAL);
  });

  it("works with no accessible branches, returning only ai-brain/forecast recommendations", async () => {
    scope.resolveBranches.mockResolvedValue([]);
    recommendation.generate.mockResolvedValue([
      {
        title: "org-wide",
        description: "d",
        impact: "i",
        confidence: 0.8,
        priority: AiPriority.HIGH,
      },
    ]);

    const result = await service.rank(admin, "org-1", undefined);

    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("org-wide");
    expect(executive.overview).not.toHaveBeenCalled();
  });
});
