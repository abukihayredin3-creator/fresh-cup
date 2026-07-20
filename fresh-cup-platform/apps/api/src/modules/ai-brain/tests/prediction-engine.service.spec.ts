import { InventoryTransactionReason, OrderStatus } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import { AiBrainTenantScopeService } from "../services/ai-brain-tenant-scope.service";
import { PredictionEngineService } from "../services/prediction-engine.service";

describe("PredictionEngineService", () => {
  let service: PredictionEngineService;
  let prisma: {
    order: { findMany: jest.Mock };
    inventoryTransaction: { findMany: jest.Mock };
  };
  let tenantScope: { resolveBranchIds: jest.Mock };

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    tenantScope = { resolveBranchIds: jest.fn().mockResolvedValue(["branch-1"]) };
    service = new PredictionEngineService(
      prisma as unknown as PrismaService,
      tenantScope as unknown as AiBrainTenantScopeService,
    );
  });

  it("resolves branch scope through the shared tenant-scope service", async () => {
    await service.predict({ organizationId: "org-1", branchId: "branch-1", metric: "sales" });

    expect(tenantScope.resolveBranchIds).toHaveBeenCalledWith("org-1", "branch-1");
  });

  it("returns a zero-confidence forecast when the organization has no branches", async () => {
    tenantScope.resolveBranchIds.mockResolvedValue([]);

    const result = await service.predict({ organizationId: "org-1", metric: "sales" });

    expect(result).toEqual({ metric: "sales", forecast: 0, confidence: 0.2, period: "tomorrow" });
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it("computes a sales forecast from real order totals, scoped to paid statuses", async () => {
    const today = new Date();
    prisma.order.findMany.mockResolvedValue([
      { total: 1000, placedAt: today },
      { total: 2000, placedAt: today },
    ]);

    const result = await service.predict({
      organizationId: "org-1",
      branchId: "branch-1",
      metric: "sales",
      period: "tomorrow",
    });

    const whereArg = prisma.order.findMany.mock.calls[0][0].where;
    expect(whereArg.branchId).toEqual({ in: ["branch-1"] });
    expect(whereArg.status).toEqual({ in: expect.arrayContaining([OrderStatus.COMPLETED]) });
    expect(result.metric).toBe("sales");
    expect(result.forecast).toBeGreaterThan(0);
    expect(result.period).toBe("tomorrow");
  });

  it("computes customer demand from order counts per day", async () => {
    const today = new Date();
    prisma.order.findMany.mockResolvedValue([{ placedAt: today }, { placedAt: today }]);

    const result = await service.predict({ organizationId: "org-1", metric: "customer_demand" });

    expect(result.metric).toBe("customer_demand");
    expect(result.forecast).toBeGreaterThan(0);
  });

  it("computes inventory demand from ORDER_DEDUCTION transactions only", async () => {
    const today = new Date();
    prisma.inventoryTransaction.findMany.mockResolvedValue([
      { delta: "-5", createdAt: today },
      { delta: "-3", createdAt: today },
    ]);

    const result = await service.predict({ organizationId: "org-1", metric: "inventory_demand" });

    const whereArg = prisma.inventoryTransaction.findMany.mock.calls[0][0].where;
    expect(whereArg.reason).toBe(InventoryTransactionReason.ORDER_DEDUCTION);
    expect(result.metric).toBe("inventory_demand");
    expect(result.forecast).toBeGreaterThan(0);
  });
});
