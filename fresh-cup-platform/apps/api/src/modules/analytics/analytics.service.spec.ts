import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let prisma: {
    order: { findMany: jest.Mock; aggregate: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
    orderItem: { findMany: jest.Mock };
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    delivery: { count: jest.Mock };
    inventoryItem: { findMany: jest.Mock };
    loyaltyLedger: { findFirst: jest.Mock };
  };

  const manager: RequestUser = { id: "manager-1", role: UserRole.MANAGER, branchId: "branch-1" };
  const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn(), aggregate: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      orderItem: { findMany: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      delivery: { count: jest.fn() },
      inventoryItem: { findMany: jest.fn() },
      loyaltyLedger: { findFirst: jest.fn() },
    };
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  describe("sales", () => {
    it("forces a manager's query to their own branch regardless of the requested branchId", async () => {
      prisma.order.findMany.mockResolvedValue([]);

      await service.sales(manager, { branchId: "someone-elses-branch" });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: "branch-1" }),
        }),
      );
    });

    it("buckets orders by day and computes totals/average correctly", async () => {
      prisma.order.findMany.mockResolvedValue([
        { total: 10000, placedAt: new Date("2026-07-01T09:00:00Z") },
        { total: 5000, placedAt: new Date("2026-07-01T18:00:00Z") },
        { total: 3000, placedAt: new Date("2026-07-02T09:00:00Z") },
      ]);

      const result = await service.sales(admin, { from: "2026-07-01", to: "2026-07-02" });

      expect(result.totalRevenue).toBe(18000);
      expect(result.totalOrders).toBe(3);
      expect(result.averageOrderValue).toBe(6000);
      expect(result.byDay).toEqual([
        { date: "2026-07-01", revenue: 15000, orders: 2 },
        { date: "2026-07-02", revenue: 3000, orders: 1 },
      ]);
    });

    it("returns zeroed totals for an empty range instead of dividing by zero", async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.sales(admin, {});

      expect(result.totalOrders).toBe(0);
      expect(result.averageOrderValue).toBe(0);
      expect(result.byDay).toEqual([]);
    });
  });

  describe("items", () => {
    it("aggregates quantity and revenue per menu item and sorts by revenue desc", async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { menuItemId: "item-a", nameSnapshot: "Mango Sunrise", quantity: 2, lineTotal: 24000 },
        { menuItemId: "item-b", nameSnapshot: "Orange Zest", quantity: 5, lineTotal: 50000 },
        { menuItemId: "item-a", nameSnapshot: "Mango Sunrise", quantity: 1, lineTotal: 12000 },
      ]);

      const result = await service.items(admin, {});

      expect(result.items).toEqual([
        { menuItemId: "item-b", name: "Orange Zest", quantitySold: 5, revenue: 50000 },
        { menuItemId: "item-a", name: "Mango Sunrise", quantitySold: 3, revenue: 36000 },
      ]);
    });

    it("respects the limit parameter", async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { menuItemId: "a", nameSnapshot: "A", quantity: 1, lineTotal: 3000 },
        { menuItemId: "b", nameSnapshot: "B", quantity: 1, lineTotal: 2000 },
        { menuItemId: "c", nameSnapshot: "C", quantity: 1, lineTotal: 1000 },
      ]);

      const result = await service.items(admin, { limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.items.map((i) => i.menuItemId)).toEqual(["a", "b"]);
    });
  });

  describe("customerDetail", () => {
    it("throws NotFoundException for a non-customer user", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: UserRole.STAFF });

      await expect(service.customerDetail(admin, "u1")).rejects.toThrow(NotFoundException);
    });

    it("forbids a manager from viewing a customer who never ordered at their branch", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: UserRole.CUSTOMER });
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: null }, _count: 0 });
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.loyaltyLedger.findFirst.mockResolvedValue(null);

      await expect(service.customerDetail(manager, "u1")).rejects.toThrow(ForbiddenException);
    });

    it("returns full detail for an admin regardless of branch history", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        role: UserRole.CUSTOMER,
        email: "c@test.dev",
        phone: null,
        fullName: "Test Customer",
        createdAt: new Date("2026-01-01"),
      });
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: 45000 }, _count: 3 });
      prisma.order.findFirst.mockResolvedValue({ placedAt: new Date("2026-07-10") });
      prisma.loyaltyLedger.findFirst.mockResolvedValue({ balanceAfter: 42 });

      const result = await service.customerDetail(admin, "u1");

      expect(result).toMatchObject({
        id: "u1",
        ordersCount: 3,
        totalSpend: 45000,
        loyaltyBalance: 42,
      });
    });
  });
});
