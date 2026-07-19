import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  InventoryTransactionReason,
  InventoryUnit,
  UserRole,
  type InventoryItem,
} from "@prisma/client";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { OrderPaidEvent } from "../../common/events/order-events";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import { InventoryService } from "./inventory.service";

describe("InventoryService", () => {
  let service: InventoryService;
  let prisma: {
    inventoryItem: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    inventoryTransaction: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    orderItem: { findMany: jest.Mock };
    recipeIngredient: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let eventEmitter: { emitAsync: jest.Mock };

  const branchId = "branch-1";
  const manager: RequestUser = { id: "manager-1", role: UserRole.MANAGER, branchId };

  const baseItem = {
    id: "item-1",
    branchId,
    name: "Mango",
    unit: InventoryUnit.GRAM,
    currentStock: 1000,
    reorderThreshold: 200,
    unitCost: 8,
    isActive: true,
  } as unknown as InventoryItem;

  beforeEach(() => {
    prisma = {
      inventoryItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryTransaction: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      orderItem: { findMany: jest.fn() },
      recipeIngredient: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    eventEmitter = { emitAsync: jest.fn() };
    service = new InventoryService(
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe("handleOrderPaid", () => {
    const event: OrderPaidEvent = {
      orderId: "order-1",
      branchId,
      userId: "user-1",
      total: 20000,
      currency: "ETB",
    };

    it("is a no-op when this order was already deducted (idempotency)", async () => {
      prisma.inventoryTransaction.findFirst.mockResolvedValue({ id: "existing-txn" });

      await service.handleOrderPaid(event);

      expect(prisma.orderItem.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("is a no-op when the order's items have no recipe mapping", async () => {
      prisma.inventoryTransaction.findFirst.mockResolvedValue(null);
      prisma.orderItem.findMany.mockResolvedValue([
        { menuItemId: "menu-1", quantity: 2, orderId: event.orderId },
      ]);
      prisma.recipeIngredient.findMany.mockResolvedValue([]);

      await service.handleOrderPaid(event);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("aggregates deductions across order items sharing an ingredient and applies negative deltas", async () => {
      prisma.inventoryTransaction.findFirst.mockResolvedValue(null);
      prisma.orderItem.findMany.mockResolvedValue([
        { menuItemId: "menu-mango-sunrise", quantity: 2, orderId: event.orderId },
        { menuItemId: "menu-green-energy", quantity: 1, orderId: event.orderId },
      ]);
      prisma.recipeIngredient.findMany.mockResolvedValue([
        { menuItemId: "menu-mango-sunrise", inventoryItemId: "item-mango", quantityPerUnit: 250 },
        { menuItemId: "menu-green-energy", inventoryItemId: "item-mango", quantityPerUnit: 100 },
      ]);
      prisma.$transaction.mockResolvedValue([]);
      prisma.inventoryItem.findUnique.mockResolvedValue({
        ...baseItem,
        id: "item-mango",
        currentStock: 5000,
      });

      await service.handleOrderPaid(event);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const operations = prisma.$transaction.mock.calls[0][0] as unknown[];
      // 1 distinct inventory item -> 1 transaction create + 1 stock update
      expect(operations).toHaveLength(2);
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryItemId: "item-mango",
          delta: -600, // 250*2 (mango sunrise) + 100*1 (green energy)
          reason: InventoryTransactionReason.ORDER_DEDUCTION,
        }),
      });
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "item-mango" },
        data: { currentStock: { increment: -600 } },
      });
    });
  });

  describe("adjustStock", () => {
    it("applies a positive delta and records a transaction", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(baseItem);
      prisma.$transaction.mockResolvedValue([{}, { ...baseItem, currentStock: 1500 }]);

      const result = await service.adjustStock(manager, baseItem.id, {
        delta: 500,
        reason: InventoryTransactionReason.RESTOCK,
      });

      expect(result.currentStock).toBe(1500);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("rejects an adjustment that would leave stock negative", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(baseItem);

      await expect(
        service.adjustStock(manager, baseItem.id, {
          delta: -2000,
          reason: InventoryTransactionReason.WASTE,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("blocks a manager from adjusting another branch's item", async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({ ...baseItem, branchId: "other-branch" });

      await expect(
        service.adjustStock(manager, baseItem.id, {
          delta: 10,
          reason: InventoryTransactionReason.RESTOCK,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("wasteReport", () => {
    it("aggregates WASTE transactions per item and sums estimated cost", async () => {
      prisma.inventoryTransaction.findMany.mockResolvedValue([
        {
          inventoryItemId: "item-mango",
          delta: -100,
          inventoryItem: { name: "Mango", unit: InventoryUnit.GRAM, unitCost: 8 },
        },
        {
          inventoryItemId: "item-mango",
          delta: -50,
          inventoryItem: { name: "Mango", unit: InventoryUnit.GRAM, unitCost: 8 },
        },
      ]);

      const report = await service.wasteReport({});

      expect(report.items).toHaveLength(1);
      expect(report.items[0]).toMatchObject({
        inventoryItemId: "item-mango",
        totalWasted: 150,
        estimatedCost: 1200,
        transactionCount: 2,
      });
      expect(report.totalEstimatedCost).toBe(1200);
    });

    it("returns an empty report when there is no waste in range", async () => {
      prisma.inventoryTransaction.findMany.mockResolvedValue([]);

      const report = await service.wasteReport({});

      expect(report.items).toEqual([]);
      expect(report.totalEstimatedCost).toBe(0);
    });
  });

  describe("predictedShortages", () => {
    it("computes avg daily consumption and days until stockout", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([{ ...baseItem, currentStock: 700 }]);
      // 14 units consumed total over the 14-day window -> 1/day average
      prisma.inventoryTransaction.findMany.mockResolvedValue([
        { inventoryItemId: baseItem.id, delta: -7 },
        { inventoryItemId: baseItem.id, delta: -7 },
      ]);

      const predictions = await service.predictedShortages(branchId);

      expect(predictions).toHaveLength(1);
      expect(predictions[0]!.avgDailyConsumption).toBeCloseTo(1, 5);
      expect(predictions[0]!.daysUntilStockout).toBeCloseTo(700, 0);
    });

    it("still flags an already-low-stock item even with zero recent consumption", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        { ...baseItem, currentStock: 100, reorderThreshold: 200 },
      ]);
      prisma.inventoryTransaction.findMany.mockResolvedValue([]);

      const predictions = await service.predictedShortages(branchId);

      expect(predictions).toHaveLength(1);
      expect(predictions[0]!.daysUntilStockout).toBeNull();
    });

    it("excludes healthy items with no recent consumption", async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([baseItem]);
      prisma.inventoryTransaction.findMany.mockResolvedValue([]);

      const predictions = await service.predictedShortages(branchId);

      expect(predictions).toEqual([]);
    });
  });

  describe("toResponse", () => {
    it("flags an item as low stock when currentStock is at or below the threshold", () => {
      const lowStockItem = { ...baseItem, currentStock: 150 } as unknown as InventoryItem;
      const response = service.toResponse(lowStockItem);
      expect(response.isLowStock).toBe(true);
    });

    it("does not flag an item as low stock when currentStock is above the threshold", () => {
      const response = service.toResponse(baseItem);
      expect(response.isLowStock).toBe(false);
    });
  });
});
