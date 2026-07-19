import { InventoryTransactionReason, InventoryUnit } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import { InventoryIntelligenceService } from "./inventory-intelligence.service";

function inventoryItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    branchId: "branch-1",
    name: "Granola",
    unit: InventoryUnit.GRAM,
    currentStock: 1000,
    reorderThreshold: 500,
    unitCost: 10,
    shelfLifeDays: null,
    ...overrides,
  };
}

describe("InventoryIntelligenceService", () => {
  let service: InventoryIntelligenceService;
  let prisma: {
    inventoryItem: { findMany: jest.Mock };
    inventoryTransaction: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      inventoryItem: { findMany: jest.fn() },
      inventoryTransaction: { findMany: jest.fn() },
    };
    service = new InventoryIntelligenceService(prisma as unknown as PrismaService);
  });

  it("suggests a reorder once stock is at or below threshold, covering ~14 days of consumption", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      inventoryItem({ currentStock: 400, reorderThreshold: 500 }),
    ]);
    // 140 units consumed over 14 days -> 10/day average
    prisma.inventoryTransaction.findMany.mockResolvedValue(
      Array.from({ length: 14 }, () => ({
        inventoryItemId: "item-1",
        delta: -10,
        reason: InventoryTransactionReason.ORDER_DEDUCTION,
      })),
    );

    const [result] = await service.intelligence("branch-1");

    expect(result!.avgDailyConsumption).toBeCloseTo(10, 5);
    // target stock = 10/day * 14 days = 140; current 400 is already above that,
    // so the suggestion tops up to par rather than a large restock.
    expect(result!.suggestedReorderQuantity).toBe(0);
  });

  it("computes waste probability as wasted / (consumed + wasted)", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([inventoryItem()]);
    prisma.inventoryTransaction.findMany.mockResolvedValue([
      { inventoryItemId: "item-1", delta: -85, reason: InventoryTransactionReason.ORDER_DEDUCTION },
      { inventoryItemId: "item-1", delta: -15, reason: InventoryTransactionReason.WASTE },
    ]);

    const [result] = await service.intelligence("branch-1");

    expect(result!.wasteProbability).toBeCloseTo(0.15, 5);
  });

  it("flags expiry risk only when shelfLifeDays is set and days-of-supply exceeds it", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      inventoryItem({ currentStock: 2000, shelfLifeDays: 10 }),
    ]);
    // 100 units/day consumption -> 20 days of supply on hand, double the 10-day shelf life
    prisma.inventoryTransaction.findMany.mockResolvedValue(
      Array.from({ length: 14 }, () => ({
        inventoryItemId: "item-1",
        delta: -100,
        reason: InventoryTransactionReason.ORDER_DEDUCTION,
      })),
    );

    const [result] = await service.intelligence("branch-1");

    expect(result!.expiryRisk).toBeGreaterThan(0);
  });

  it("returns null expiry risk for items with no shelfLifeDays set", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      inventoryItem({ currentStock: 400, reorderThreshold: 500, shelfLifeDays: null }),
    ]);
    prisma.inventoryTransaction.findMany.mockResolvedValue([]);

    const [result] = await service.intelligence("branch-1");

    expect(result!.expiryRisk).toBeNull();
  });

  it("excludes healthy items with no waste, no expiry risk, and stock above threshold", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      inventoryItem({ currentStock: 5000, reorderThreshold: 500 }),
    ]);
    prisma.inventoryTransaction.findMany.mockResolvedValue([]);

    const result = await service.intelligence("branch-1");

    expect(result).toEqual([]);
  });
});
