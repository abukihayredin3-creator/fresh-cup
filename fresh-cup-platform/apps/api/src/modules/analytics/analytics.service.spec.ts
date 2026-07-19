import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DeliveryStatus, UserRole } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let prisma: {
    order: { findMany: jest.Mock; aggregate: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
    orderItem: { findMany: jest.Mock };
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    delivery: { count: jest.Mock; findMany: jest.Mock };
    inventoryItem: { findMany: jest.Mock };
    kitchenStation: { findMany: jest.Mock };
    loyaltyLedger: { findFirst: jest.Mock };
  };

  const manager: RequestUser = { id: "manager-1", role: UserRole.MANAGER, branchId: "branch-1" };
  const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn(), aggregate: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      orderItem: { findMany: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      delivery: { count: jest.fn(), findMany: jest.fn() },
      inventoryItem: { findMany: jest.fn() },
      kitchenStation: { findMany: jest.fn() },
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

  describe("kitchenPerformance", () => {
    it("averages readyAt - preparingAt across completed orders", async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          preparingAt: new Date("2026-07-01T09:00:00Z"),
          readyAt: new Date("2026-07-01T09:05:00Z"),
        },
        {
          preparingAt: new Date("2026-07-01T10:00:00Z"),
          readyAt: new Date("2026-07-01T10:10:00Z"),
        },
      ]);
      prisma.orderItem.findMany.mockResolvedValue([
        { stationId: "station-1", prepTimeSeconds: 120 },
        { stationId: "station-1", prepTimeSeconds: 180 },
      ]);
      prisma.kitchenStation.findMany.mockResolvedValue([{ id: "station-1", name: "Juice Bar" }]);

      const result = await service.kitchenPerformance(admin, {});

      expect(result.completedOrders).toBe(2);
      expect(result.avgPrepSeconds).toBe(450); // (300 + 600) / 2
      expect(result.byStation).toEqual([
        {
          stationId: "station-1",
          stationName: "Juice Bar",
          itemCount: 2,
          avgEstimatedPrepSeconds: 150,
        },
      ]);
    });

    it("returns a null average when no orders completed in range", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.orderItem.findMany.mockResolvedValue([]);
      prisma.kitchenStation.findMany.mockResolvedValue([]);

      const result = await service.kitchenPerformance(admin, {});

      expect(result.avgPrepSeconds).toBeNull();
      expect(result.byStation).toEqual([]);
    });
  });

  describe("deliveryPerformance", () => {
    it("averages assignedAt -> deliveredAt for DELIVERED deliveries and buckets by zone", async () => {
      prisma.delivery.findMany.mockResolvedValue([
        {
          status: DeliveryStatus.DELIVERED,
          assignedAt: new Date("2026-07-01T09:00:00Z"),
          deliveredAt: new Date("2026-07-01T09:30:00Z"),
          fee: 5000,
          zoneId: "zone-1",
          zone: { id: "zone-1", name: "Downtown" },
        },
        {
          status: DeliveryStatus.FAILED,
          assignedAt: new Date("2026-07-01T09:00:00Z"),
          deliveredAt: null,
          fee: 3000,
          zoneId: null,
          zone: null,
        },
      ]);

      const result = await service.deliveryPerformance(admin, {});

      expect(result.totalDeliveries).toBe(2);
      expect(result.completedDeliveries).toBe(1);
      expect(result.avgDeliveryMinutes).toBe(30);
      expect(result.byZone).toEqual([
        { zoneId: "zone-1", zoneName: "Downtown", deliveredCount: 1, avgFee: 5000 },
      ]);
    });

    it("returns a null average when there are no completed deliveries", async () => {
      prisma.delivery.findMany.mockResolvedValue([]);

      const result = await service.deliveryPerformance(admin, {});

      expect(result.avgDeliveryMinutes).toBeNull();
      expect(result.byZone).toEqual([]);
    });
  });

  describe("deliveryHeatmap", () => {
    it("maps delivered orders' coordinates to heatmap points", async () => {
      prisma.order.findMany.mockResolvedValue([
        { deliveryLat: "9.010000", deliveryLng: "38.760000" },
      ]);

      const result = await service.deliveryHeatmap(admin, {});

      expect(result.points).toEqual([{ lat: 9.01, lng: 38.76 }]);
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
