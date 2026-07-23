import { AiPriority, ExecutiveAlertStatus, UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import { DecisionEngineService } from "../../ai-brain/services/decision-engine.service";
import { PredictionEngineService } from "../../ai-brain/services/prediction-engine.service";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { AiCopilotScopeService } from "../services/ai-copilot-scope.service";
import { BusinessHealthService } from "../services/business-health.service";
import { ExecutiveDashboardService } from "../services/executive-dashboard.service";
import { RecommendationPriorityService } from "../services/recommendation-priority.service";

const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

function overviewFor(revenue: number, profit: number, carts: number, orders: number) {
  return {
    from: "2026-01-01",
    to: "2026-01-08",
    totalRevenue: revenue,
    totalEstimatedProfit: profit,
    repeatCustomerRate: 0.4,
    revenueTrend: [],
    productProfitability: [],
    branchComparison: [],
    customerGrowth: [],
    peakHours: [],
    conversionMetrics: {
      cartsCreated: carts,
      ordersPlaced: orders,
      conversionRate: orders / carts,
    },
    inventoryCosts: { purchasingSpend: 0, wasteCost: 0 },
    marketingRoi: {
      couponDiscountGiven: 0,
      revenueFromCouponOrders: 0,
      returnPerDiscountBirr: null,
    },
  };
}

describe("ExecutiveDashboardService", () => {
  let service: ExecutiveDashboardService;
  let prisma: { executiveAlert: { findMany: jest.Mock } };
  let scope: { resolveBranches: jest.Mock };
  let executive: { overview: jest.Mock };
  let businessHealth: { computeHealth: jest.Mock };
  let recommendationPriority: { rank: jest.Mock };
  let prediction: { predict: jest.Mock };
  let decision: { decide: jest.Mock };

  beforeEach(() => {
    prisma = { executiveAlert: { findMany: jest.fn().mockResolvedValue([]) } };
    scope = { resolveBranches: jest.fn().mockResolvedValue(["branch-1"]) };
    executive = { overview: jest.fn().mockResolvedValue(overviewFor(1000, 300, 20, 10)) };
    businessHealth = {
      computeHealth: jest.fn().mockResolvedValue({ id: "health-1", overallScore: 80 }),
    };
    recommendationPriority = { rank: jest.fn().mockResolvedValue([]) };
    prediction = {
      predict: jest
        .fn()
        .mockResolvedValue({ metric: "sales", forecast: 100, confidence: 0.7, period: "tomorrow" }),
    };
    decision = { decide: jest.fn().mockResolvedValue([]) };

    service = new ExecutiveDashboardService(
      prisma as unknown as PrismaService,
      scope as unknown as AiCopilotScopeService,
      executive as unknown as ExecutiveService,
      businessHealth as unknown as BusinessHealthService,
      recommendationPriority as unknown as RecommendationPriorityService,
      prediction as unknown as PredictionEngineService,
      decision as unknown as DecisionEngineService,
    );
  });

  it("assembles every dashboard section for a single branch", async () => {
    const result = await service.getDashboard(admin, "org-1", "branch-1");

    expect(result.overview.totalRevenue).toBe(1000);
    expect(result.overview.totalEstimatedProfit).toBe(300);
    expect(result.overview.conversionRate).toBe(0.5);
    expect(result.kpis).toHaveLength(4);
    expect(result.healthScore.overallScore).toBe(80);
    expect(prediction.predict).toHaveBeenCalledTimes(3); // sales, inventory_demand, customer_demand
    expect(businessHealth.computeHealth).toHaveBeenCalledWith(admin, "org-1", "branch-1");
  });

  it("merges revenue/profit sums and a correctly weighted conversion rate across branches", async () => {
    scope.resolveBranches.mockResolvedValue(["branch-1", "branch-2"]);
    executive.overview
      .mockResolvedValueOnce(overviewFor(1000, 300, 20, 10))
      .mockResolvedValueOnce(overviewFor(500, 100, 10, 8));

    const result = await service.getDashboard(admin, "org-1", undefined);

    expect(result.overview.totalRevenue).toBe(1500);
    expect(result.overview.totalEstimatedProfit).toBe(400);
    expect(result.overview.conversionRate).toBe(0.6); // (10+8)/(20+10)
    expect(prediction.predict).toHaveBeenCalledTimes(6); // 3 metrics x 2 branches
  });

  it("reads active alerts scoped by organization, branch, and ACTIVE status without regenerating them", async () => {
    await service.getDashboard(admin, "org-1", "branch-1");

    expect(prisma.executiveAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          branchId: "branch-1",
          status: ExecutiveAlertStatus.ACTIVE,
        },
      }),
    );
  });

  it("caps recommendations and priority actions at their configured limits", async () => {
    recommendationPriority.rank.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        source: "ai-brain",
        title: `rec-${i}`,
        description: "d",
        impact: "i",
        confidence: 0.5,
        priority: AiPriority.MEDIUM,
      })),
    );
    decision.decide.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `dec-${i}`,
        decisionType: "RECOMMENDATION_ACTION",
      })),
    );

    const result = await service.getDashboard(admin, "org-1", "branch-1");

    expect(result.aiRecommendations).toHaveLength(10);
    expect(result.priorityActions).toHaveLength(5);
  });

  it("handles an actor with no accessible branches without throwing", async () => {
    scope.resolveBranches.mockResolvedValue([]);

    const result = await service.getDashboard(admin, "org-1", undefined);

    expect(result.overview.totalRevenue).toBe(0);
    expect(result.predictions).toEqual([]);
    expect(executive.overview).not.toHaveBeenCalled();
  });
});
