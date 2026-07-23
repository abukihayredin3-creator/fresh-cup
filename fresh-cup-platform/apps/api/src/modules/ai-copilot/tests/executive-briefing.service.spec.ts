import { AiPriority, UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import { RecommendationEngineService } from "../../ai-brain/services/recommendation-engine.service";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { InventoryIntelligenceService } from "../../intelligence/inventory-intelligence/inventory-intelligence.service";
import { AiCopilotScopeService } from "../services/ai-copilot-scope.service";
import { AnomalyDetectionService } from "../services/anomaly-detection.service";
import { ExecutiveBriefingService } from "../services/executive-briefing.service";

const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

function emptyOverview(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    from: "2026-01-01",
    to: "2026-01-08",
    totalRevenue: 1000,
    totalEstimatedProfit: 300,
    repeatCustomerRate: 0.5,
    revenueTrend: [],
    productProfitability: [
      {
        menuItemId: "m1",
        nameEn: "Mango Smoothie",
        revenue: 500,
        estimatedCogs: 100,
        estimatedMargin: 400,
      },
      {
        menuItemId: "m2",
        nameEn: "Avocado Juice",
        revenue: 100,
        estimatedCogs: 90,
        estimatedMargin: 10,
      },
    ],
    branchComparison: [],
    customerGrowth: [],
    peakHours: [],
    conversionMetrics: { cartsCreated: 10, ordersPlaced: 5, conversionRate: 0.5 },
    inventoryCosts: { purchasingSpend: 0, wasteCost: 0 },
    marketingRoi: {
      couponDiscountGiven: 0,
      revenueFromCouponOrders: 0,
      returnPerDiscountBirr: null,
    },
    ...overrides,
  };
}

describe("ExecutiveBriefingService", () => {
  let service: ExecutiveBriefingService;
  let prisma: {
    executiveBriefing: { create: jest.Mock };
    shift: { findMany: jest.Mock };
  };
  let scope: { resolveBranches: jest.Mock };
  let executive: { overview: jest.Mock };
  let inventoryIntelligence: { intelligence: jest.Mock };
  let recommendation: { generate: jest.Mock };
  let anomalyDetection: { detect: jest.Mock };

  beforeEach(() => {
    prisma = {
      executiveBriefing: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "brief-1", ...data })),
      },
      shift: { findMany: jest.fn().mockResolvedValue([]) },
    };
    scope = { resolveBranches: jest.fn().mockResolvedValue(["branch-1"]) };
    executive = { overview: jest.fn().mockResolvedValue(emptyOverview()) };
    inventoryIntelligence = { intelligence: jest.fn().mockResolvedValue([]) };
    recommendation = { generate: jest.fn().mockResolvedValue([]) };
    anomalyDetection = { detect: jest.fn().mockResolvedValue([]) };

    service = new ExecutiveBriefingService(
      prisma as unknown as PrismaService,
      scope as unknown as AiCopilotScopeService,
      executive as unknown as ExecutiveService,
      inventoryIntelligence as unknown as InventoryIntelligenceService,
      recommendation as unknown as RecommendationEngineService,
      anomalyDetection as unknown as AnomalyDetectionService,
    );
  });

  it("assembles revenue/profit summaries and top/bottom products from ExecutiveService.overview", async () => {
    const result = await service.generateBriefing(admin, "org-1", "branch-1");

    const data = prisma.executiveBriefing.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe("org-1");
    expect(data.branchId).toBe("branch-1");
    expect(data.revenueSummary.currentRevenue).toBe(1000);
    expect(data.profitSummary.currentProfit).toBe(300);
    expect(data.topProducts[0].menuItemId).toBe("m1");
    expect(data.bottomProducts[0].menuItemId).toBe("m2");
    expect(result.id).toBe("brief-1");
  });

  it("defaults risk level to LOW and confidence to 0.7 with no anomalies or recommendations", async () => {
    await service.generateBriefing(admin, "org-1", "branch-1");

    const data = prisma.executiveBriefing.create.mock.calls[0][0].data;
    expect(data.riskLevel).toBe(AiPriority.LOW);
    expect(data.confidenceScore).toBe(0.7);
  });

  it("sets risk level to the highest anomaly severity detected", async () => {
    anomalyDetection.detect.mockResolvedValue([
      { severity: AiPriority.MEDIUM },
      { severity: AiPriority.CRITICAL },
      { severity: AiPriority.LOW },
    ]);

    await service.generateBriefing(admin, "org-1", "branch-1");

    const data = prisma.executiveBriefing.create.mock.calls[0][0].data;
    expect(data.riskLevel).toBe(AiPriority.CRITICAL);
  });

  it("averages recommendation confidences when present", async () => {
    recommendation.generate.mockResolvedValue([
      { title: "a", description: "d", impact: "i", confidence: 0.6, priority: AiPriority.MEDIUM },
      { title: "b", description: "d", impact: "i", confidence: 0.8, priority: AiPriority.HIGH },
    ]);

    await service.generateBriefing(admin, "org-1", "branch-1");

    const data = prisma.executiveBriefing.create.mock.calls[0][0].data;
    expect(data.confidenceScore).toBe(0.7);
    expect(data.aiRecommendations).toHaveLength(2);
  });

  it("flags a staffing alert when demand is above average and shift coverage is thin", async () => {
    executive.overview.mockResolvedValue(
      emptyOverview({
        revenueTrend: [
          { date: "2026-01-01", revenue: 100, estimatedProfit: 30 },
          { date: "2026-01-02", revenue: 100, estimatedProfit: 30 },
          { date: "2026-01-03", revenue: 500, estimatedProfit: 150 }, // spike day
        ],
      }),
    );
    prisma.shift.findMany.mockResolvedValue([
      { startsAt: new Date("2026-01-01T10:00:00Z") },
      { startsAt: new Date("2026-01-01T14:00:00Z") },
      { startsAt: new Date("2026-01-02T10:00:00Z") },
      { startsAt: new Date("2026-01-02T14:00:00Z") },
      // 2026-01-03 (the spike day) has no shifts at all
    ]);

    await service.generateBriefing(admin, "org-1", "branch-1");

    const data = prisma.executiveBriefing.create.mock.calls[0][0].data;
    expect(data.staffingAlerts).toHaveLength(1);
    expect(data.staffingAlerts[0].date).toBe("2026-01-03");
  });

  it("produces no staffing alerts when there is no revenue trend to compare against", async () => {
    await service.generateBriefing(admin, "org-1", "branch-1");

    const data = prisma.executiveBriefing.create.mock.calls[0][0].data;
    expect(data.staffingAlerts).toEqual([]);
    expect(prisma.shift.findMany).not.toHaveBeenCalled();
  });

  it("handles an actor with no accessible branches without throwing", async () => {
    scope.resolveBranches.mockResolvedValue([]);

    const result = await service.generateBriefing(admin, "org-1", undefined);

    expect(result).toBeDefined();
    const data = prisma.executiveBriefing.create.mock.calls[0][0].data;
    expect(data.revenueSummary.currentRevenue).toBe(0);
    expect(executive.overview).not.toHaveBeenCalled();
  });
});
