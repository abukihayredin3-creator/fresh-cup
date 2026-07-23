import { AiPriority, InventoryTransactionReason, UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../../ai-brain/interfaces/ai-brain.interfaces";
import { ReasoningEngineService } from "../../ai-brain/services/reasoning-engine.service";
import { AnomalyDetectionService } from "../services/anomaly-detection.service";
import { AiCopilotScopeService } from "../services/ai-copilot-scope.service";

const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

function stableSalesInsight(): { content: ReasoningResult } {
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
          revenueChangePct: 0,
          currentOrderCount: 10,
          previousOrderCount: 10,
          orderChangePct: 0,
        },
      },
    },
  };
}

describe("AnomalyDetectionService", () => {
  let service: AnomalyDetectionService;
  let prisma: {
    executiveAlert: { create: jest.Mock };
    inventoryTransaction: { findMany: jest.Mock };
    productReview: { findMany: jest.Mock };
  };
  let scope: { resolveBranches: jest.Mock };
  let reasoning: { analyze: jest.Mock };

  const today = new Date();

  beforeEach(() => {
    prisma = {
      executiveAlert: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "alert-1", ...data })),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      productReview: { findMany: jest.fn().mockResolvedValue([]) },
    };
    scope = { resolveBranches: jest.fn().mockResolvedValue(["branch-1"]) };
    reasoning = { analyze: jest.fn().mockResolvedValue(stableSalesInsight()) };

    service = new AnomalyDetectionService(
      prisma as unknown as PrismaService,
      scope as unknown as AiCopilotScopeService,
      reasoning as unknown as ReasoningEngineService,
    );
  });

  it("returns nothing when every signal is unremarkable", async () => {
    const result = await service.detect(admin, "org-1", "branch-1");

    expect(result).toEqual([]);
    expect(prisma.executiveAlert.create).not.toHaveBeenCalled();
  });

  it("flags a revenue drop from the reasoning engine's sales signal", async () => {
    reasoning.analyze.mockResolvedValue({
      content: {
        ...stableSalesInsight().content,
        confidence: 0.9,
        signals: {
          kind: "sales",
          trend: {
            currentRevenue: 500,
            previousRevenue: 1000,
            revenueChangePct: -50,
            currentOrderCount: 9,
            previousOrderCount: 10,
            orderChangePct: -10,
          },
        },
      },
    });

    const result = await service.detect(admin, "org-1", "branch-1");

    const revenueAlert = result.find((a) => a.type === "REVENUE_DROP");
    expect(revenueAlert).toBeDefined();
    expect(revenueAlert?.severity).toBe(AiPriority.CRITICAL);
    const data = prisma.executiveAlert.create.mock.calls.find(
      (call) => call[0].data.type === "REVENUE_DROP",
    )?.[0].data;
    expect(data.organizationId).toBe("org-1");
    expect(data.branchId).toBe("branch-1");
  });

  it("flags unusually low orders separately from revenue", async () => {
    reasoning.analyze.mockResolvedValue({
      content: {
        ...stableSalesInsight().content,
        signals: {
          kind: "sales",
          trend: {
            currentRevenue: 950,
            previousRevenue: 1000,
            revenueChangePct: -5,
            currentOrderCount: 5,
            previousOrderCount: 10,
            orderChangePct: -50,
          },
        },
      },
    });

    const result = await service.detect(admin, "org-1", "branch-1");

    expect(result.some((a) => a.type === "ORDERS_LOW")).toBe(true);
    expect(result.some((a) => a.type === "REVENUE_DROP")).toBe(false);
  });

  it("flags a waste spike from a real week-over-week WASTE cost comparison", async () => {
    const lastWeek = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
    prisma.inventoryTransaction.findMany.mockImplementation(
      ({ where }: { where: { reason: string } }) => {
        if (where.reason === InventoryTransactionReason.WASTE) {
          return Promise.resolve([
            { delta: "-10", createdAt: lastWeek, inventoryItem: { unitCost: 500 } },
            { delta: "-2", createdAt: twoWeeksAgo, inventoryItem: { unitCost: 500 } },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const result = await service.detect(admin, "org-1", "branch-1");

    const wasteAlert = result.find((a) => a.type === "WASTE_HIGH");
    expect(wasteAlert).toBeDefined();
  });

  it("flags an inventory mismatch when manual adjustments are frequent", async () => {
    const now = new Date();
    prisma.inventoryTransaction.findMany.mockImplementation(
      ({ where }: { where: { reason: string } }) => {
        if (where.reason === InventoryTransactionReason.MANUAL_ADJUSTMENT) {
          return Promise.resolve([
            { delta: "1", inventoryItemId: "i1", createdAt: now },
            { delta: "-1", inventoryItemId: "i2", createdAt: now },
            { delta: "2", inventoryItemId: "i3", createdAt: now },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const result = await service.detect(admin, "org-1", "branch-1");

    expect(result.some((a) => a.type === "INVENTORY_MISMATCH")).toBe(true);
  });

  it("does not flag inventory mismatch below the adjustment count threshold", async () => {
    prisma.inventoryTransaction.findMany.mockImplementation(
      ({ where }: { where: { reason: string } }) => {
        if (where.reason === InventoryTransactionReason.MANUAL_ADJUSTMENT) {
          return Promise.resolve([{ delta: "1", inventoryItemId: "i1", createdAt: new Date() }]);
        }
        return Promise.resolve([]);
      },
    );

    const result = await service.detect(admin, "org-1", "branch-1");

    expect(result.some((a) => a.type === "INVENTORY_MISMATCH")).toBe(false);
  });

  it("flags a customer complaint spike from low-rating reviews", async () => {
    const now = new Date();
    prisma.productReview.findMany.mockResolvedValue([
      { createdAt: now },
      { createdAt: now },
      { createdAt: now },
    ]);

    const result = await service.detect(admin, "org-1", "branch-1");

    expect(result.some((a) => a.type === "COMPLAINT_SPIKE")).toBe(true);
  });

  it("returns nothing when the actor has no accessible branches", async () => {
    scope.resolveBranches.mockResolvedValue([]);

    const result = await service.detect(admin, "org-1", undefined);

    expect(result).toEqual([]);
    expect(reasoning.analyze).not.toHaveBeenCalled();
  });
});
