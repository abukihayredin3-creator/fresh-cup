import { AiPriority, UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../../ai-brain/interfaces/ai-brain.interfaces";
import { DecisionEngineService } from "../../ai-brain/services/decision-engine.service";
import { ReasoningEngineService } from "../../ai-brain/services/reasoning-engine.service";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { AiCopilotScopeService } from "../services/ai-copilot-scope.service";
import { ExecutiveSummaryService } from "../services/executive-summary.service";
import { RecommendationPriorityService } from "../services/recommendation-priority.service";

const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

function salesInsight(revenueChangePct: number): { content: ReasoningResult } {
  return {
    content: {
      category: "sales",
      problem: "",
      causes: [],
      confidence: 0.8,
      evidence: [],
      signals: {
        kind: "sales",
        trend: {
          currentRevenue: 1000,
          previousRevenue: 1000,
          revenueChangePct,
          currentOrderCount: 10,
          previousOrderCount: 10,
          orderChangePct: 0,
        },
      },
    },
  };
}

function overviewWithCosts(purchasingSpend: number, wasteCost: number) {
  return {
    from: "",
    to: "",
    totalRevenue: 0,
    totalEstimatedProfit: 0,
    repeatCustomerRate: 0,
    revenueTrend: [],
    productProfitability: [],
    branchComparison: [],
    customerGrowth: [],
    peakHours: [],
    conversionMetrics: { cartsCreated: 0, ordersPlaced: 0, conversionRate: 0 },
    inventoryCosts: { purchasingSpend, wasteCost },
    marketingRoi: {
      couponDiscountGiven: 0,
      revenueFromCouponOrders: 0,
      returnPerDiscountBirr: null,
    },
  };
}

describe("ExecutiveSummaryService", () => {
  let service: ExecutiveSummaryService;
  let prisma: { executiveSummary: { create: jest.Mock } };
  let scope: { resolveBranches: jest.Mock };
  let reasoning: { analyze: jest.Mock };
  let executive: { overview: jest.Mock };
  let decision: { decide: jest.Mock };
  let recommendationPriority: { rank: jest.Mock };

  beforeEach(() => {
    prisma = {
      executiveSummary: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "summary-1", ...data })),
      },
    };
    scope = { resolveBranches: jest.fn().mockResolvedValue(["branch-1"]) };
    reasoning = { analyze: jest.fn().mockResolvedValue(salesInsight(0)) };
    executive = { overview: jest.fn().mockResolvedValue(overviewWithCosts(1000, 0)) };
    decision = { decide: jest.fn().mockResolvedValue([]) };
    recommendationPriority = { rank: jest.fn().mockResolvedValue([]) };

    service = new ExecutiveSummaryService(
      prisma as unknown as PrismaService,
      scope as unknown as AiCopilotScopeService,
      reasoning as unknown as ReasoningEngineService,
      executive as unknown as ExecutiveService,
      decision as unknown as DecisionEngineService,
      recommendationPriority as unknown as RecommendationPriorityService,
    );
  });

  it("describes a revenue increase using real reasoning-engine data", async () => {
    reasoning.analyze.mockResolvedValue(salesInsight(14));

    const result = await service.generateSummary(admin, "org-1", "branch-1", "week");

    expect(result.content).toContain("This week revenue increased by 14%.");
    const data = prisma.executiveSummary.create.mock.calls[0][0].data;
    expect(data.keyMetrics.revenueChangePct).toBe(14);
    expect(data.period).toBe("week");
    expect(data.organizationId).toBe("org-1");
    expect(data.branchId).toBe("branch-1");
  });

  it("describes a revenue decrease and omits the inventory sentence when the swing is small", async () => {
    reasoning.analyze.mockResolvedValue(salesInsight(-8));

    const result = await service.generateSummary(admin, "org-1", "branch-1", "week");

    expect(result.content).toContain("revenue decreased by 8%");
    expect(result.content).not.toContain("Inventory costs");
  });

  it("says revenue held steady for a near-zero change", async () => {
    reasoning.analyze.mockResolvedValue(salesInsight(0.5));

    const result = await service.generateSummary(admin, "org-1", "branch-1", "week");

    expect(result.content).toContain("revenue held steady");
  });

  it("adds an inventory cost sentence when the week-over-week swing is notable", async () => {
    // The current window's query always ends "now"; the previous window's query ends
    // on the current window's start instead (~7 days ago) — that's how the two calls
    // are told apart, since both now use full ISO timestamps, not date-only strings.
    const recentCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    executive.overview.mockImplementation((_actor: unknown, query: { to: string }) =>
      Promise.resolve(
        overviewWithCosts(new Date(query.to).getTime() > recentCutoff ? 1200 : 1000, 0),
      ),
    );

    const result = await service.generateSummary(admin, "org-1", "branch-1", "week");

    expect(result.content).toContain("Inventory costs rose by");
  });

  it("includes the AI Brain's demand-forecast sentence when a DEMAND_FORECAST decision exists", async () => {
    decision.decide.mockResolvedValue([
      {
        decisionType: "DEMAND_FORECAST",
        priority: AiPriority.HIGH,
        confidence: 0.8,
        output: {
          action: "Increase production",
          reason: "weekend demand is expected to increase significantly",
        },
      },
    ]);

    const result = await service.generateSummary(admin, "org-1", "branch-1", "week");

    expect(result.content).toContain("Weekend demand is expected to increase significantly.");
  });

  it("includes the top-ranked recommendation as the most important action", async () => {
    recommendationPriority.rank.mockResolvedValue([
      {
        source: "inventory",
        title: "Replenish avocado inventory",
        description: "d",
        impact: "i",
        confidence: 0.8,
        priority: AiPriority.HIGH,
      },
    ]);

    const result = await service.generateSummary(admin, "org-1", "branch-1", "week");

    expect(result.content).toContain(
      "The most important action is to replenish avocado inventory.",
    );
  });

  it("defaults to a week period and produces a summary for a branchless actor", async () => {
    scope.resolveBranches.mockResolvedValue([]);

    const result = await service.generateSummary(admin, "org-1", undefined);

    expect(result).toBeDefined();
    const data = prisma.executiveSummary.create.mock.calls[0][0].data;
    expect(data.period).toBe("week");
    expect(data.keyMetrics.revenueChangePct).toBe(0);
  });
});
