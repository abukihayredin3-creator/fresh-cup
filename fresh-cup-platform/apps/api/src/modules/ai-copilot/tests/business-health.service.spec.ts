import { HealthTrend, UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../../ai-brain/interfaces/ai-brain.interfaces";
import { ReasoningEngineService } from "../../ai-brain/services/reasoning-engine.service";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { InventoryIntelligenceService } from "../../intelligence/inventory-intelligence/inventory-intelligence.service";
import { AiCopilotScopeService } from "../services/ai-copilot-scope.service";
import { BusinessHealthService } from "../services/business-health.service";

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

function customerInsight(customerChangePct: number): { content: ReasoningResult } {
  return {
    content: {
      category: "customer",
      problem: "",
      causes: [],
      confidence: 0.8,
      evidence: [],
      signals: {
        kind: "customer",
        trend: {
          currentCustomers: 10,
          previousCustomers: 10,
          customerChangePct,
          repeatChangePct: 0,
        },
      },
    },
  };
}

describe("BusinessHealthService", () => {
  let service: BusinessHealthService;
  let prisma: {
    businessHealthSnapshot: { create: jest.Mock; findFirst: jest.Mock };
    inventoryItem: { count: jest.Mock };
    shift: { count: jest.Mock };
  };
  let scope: { resolveBranches: jest.Mock };
  let reasoning: { analyze: jest.Mock };
  let executive: { overview: jest.Mock };
  let inventoryIntelligence: { intelligence: jest.Mock };

  beforeEach(() => {
    prisma = {
      businessHealthSnapshot: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "snap-1", ...data })),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      inventoryItem: { count: jest.fn().mockResolvedValue(10) },
      shift: { count: jest.fn().mockResolvedValue(0) },
    };
    scope = { resolveBranches: jest.fn().mockResolvedValue(["branch-1"]) };
    reasoning = {
      analyze: jest
        .fn()
        .mockImplementation((_org: string, category: string) =>
          Promise.resolve(category === "sales" ? salesInsight(0) : customerInsight(0)),
        ),
    };
    executive = {
      overview: jest.fn().mockResolvedValue({
        totalRevenue: 1000,
        totalEstimatedProfit: 300,
        repeatCustomerRate: 0.5,
        conversionMetrics: { cartsCreated: 20, ordersPlaced: 10, conversionRate: 0.5 },
      }),
    };
    inventoryIntelligence = { intelligence: jest.fn().mockResolvedValue([]) };

    service = new BusinessHealthService(
      prisma as unknown as PrismaService,
      scope as unknown as AiCopilotScopeService,
      reasoning as unknown as ReasoningEngineService,
      executive as unknown as ExecutiveService,
      inventoryIntelligence as unknown as InventoryIntelligenceService,
    );
  });

  it("computes a full score breakdown scoped through AiCopilotScopeService", async () => {
    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(scope.resolveBranches).toHaveBeenCalledWith(admin, "org-1", "branch-1");
    expect(result.revenueScore).toBe(70); // 0% change -> baseline
    expect(result.profitScore).toBe(75); // 30% margin * 250
    expect(result.inventoryScore).toBe(100); // no flagged items
    expect(result.operationsScore).toBe(100); // 50% conversion * 200
    expect(result.staffScore).toBe(100); // no shift data
    expect(prisma.businessHealthSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: "org-1" }) }),
    );
  });

  it("rewards a rising revenue trend with a higher revenue score", async () => {
    reasoning.analyze.mockImplementation((_org: string, category: string) =>
      Promise.resolve(category === "sales" ? salesInsight(20) : customerInsight(0)),
    );

    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(result.revenueScore).toBe(100); // 70 + 20*1.5, clamped to 100
  });

  it("penalizes the inventory score when items are flagged at risk", async () => {
    inventoryIntelligence.intelligence.mockResolvedValue([
      { inventoryItemId: "i1" },
      { inventoryItemId: "i2" },
    ]);
    prisma.inventoryItem.count.mockResolvedValue(10);

    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(result.inventoryScore).toBe(80); // 100 - (2/10)*100
  });

  it("penalizes the staff score for missed shifts", async () => {
    prisma.shift.count.mockImplementation(({ where }: { where: { status: string } }) =>
      Promise.resolve(where.status === "MISSED" ? 1 : 3),
    );

    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(result.staffScore).toBe(75); // 100 - (1/4)*100
  });

  it("averages scores across every branch when no branchId is requested", async () => {
    scope.resolveBranches.mockResolvedValue(["branch-1", "branch-2"]);
    reasoning.analyze.mockImplementation((_org: string, category: string, branchId?: string) => {
      if (category === "sales") {
        return Promise.resolve(salesInsight(branchId === "branch-1" ? 0 : 20));
      }
      return Promise.resolve(customerInsight(0));
    });

    const result = await service.computeHealth(admin, "org-1", undefined);

    expect(result.revenueScore).toBe(85); // average of 70 and 100
    expect(executive.overview).toHaveBeenCalledTimes(2);
  });

  it("returns all-zero scores when the actor has no accessible branches", async () => {
    scope.resolveBranches.mockResolvedValue([]);

    const result = await service.computeHealth(admin, "org-1", undefined);

    expect(result.overallScore).toBe(0);
    expect(executive.overview).not.toHaveBeenCalled();
  });

  it("marks the trend IMPROVING when the score rose meaningfully since the last snapshot", async () => {
    prisma.businessHealthSnapshot.findFirst.mockResolvedValue({ overallScore: 50 });

    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(result.trend).toBe(HealthTrend.IMPROVING);
  });

  it("marks the trend DECLINING when the score fell meaningfully", async () => {
    prisma.businessHealthSnapshot.findFirst.mockResolvedValue({ overallScore: 95 });

    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(result.trend).toBe(HealthTrend.DECLINING);
  });

  it("marks the trend STABLE for a small, noise-level swing", async () => {
    prisma.businessHealthSnapshot.findFirst.mockResolvedValue({ overallScore: 84 });

    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(result.trend).toBe(HealthTrend.STABLE);
  });

  it("defaults to STABLE with no prior snapshot", async () => {
    const result = await service.computeHealth(admin, "org-1", "branch-1");

    expect(result.trend).toBe(HealthTrend.STABLE);
  });
});
