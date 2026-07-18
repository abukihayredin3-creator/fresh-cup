import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  InventoryTransactionReason,
  InventoryUnit,
  UserRole,
  type InventoryItem,
} from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import { InventoryService } from "./inventory.service";

describe("InventoryService", () => {
  let service: InventoryService;
  let prisma: {
    inventoryItem: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    inventoryTransaction: { create: jest.Mock };
    $transaction: jest.Mock;
  };

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
      inventoryItem: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      inventoryTransaction: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new InventoryService(prisma as unknown as PrismaService);
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
