import type { RequestUser } from "../../common/types/request-user.interface";
import type { PrismaService } from "../../database/prisma.service";
import type { CustomerIntelligenceService } from "../../modules/intelligence/customer-intelligence/customer-intelligence.service";
import type { InventoryIntelligenceService } from "../../modules/intelligence/inventory-intelligence/inventory-intelligence.service";
import type { MarketingIntelligenceService } from "../../modules/intelligence/marketing-intelligence/marketing-intelligence.service";
import { FeatureStoreService } from "./feature-store.service";

const actor: RequestUser = { id: "user-1", role: "MANAGER" as never, branchId: null };

describe("FeatureStoreService", () => {
  function makeService() {
    const prisma = {
      coupon: { count: jest.fn().mockResolvedValue(0) },
      campaign: { count: jest.fn().mockResolvedValue(0) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      purchaseOrderLine: { findMany: jest.fn().mockResolvedValue([]) },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      kitchenStation: { findUnique: jest.fn().mockResolvedValue({ name: "Blending" }) },
      delivery: { findMany: jest.fn().mockResolvedValue([]) },
      deliveryZone: { findUnique: jest.fn().mockResolvedValue({ name: "Merkato Core" }) },
    } as unknown as jest.Mocked<PrismaService>;

    const customerIntelligence = {
      customerProfile: jest.fn().mockResolvedValue({
        userId: "cust-1",
        purchaseFrequencyDays: 10,
        avgOrderValue: 5000,
        recencyDays: 3,
        favoriteCategories: [{ categoryId: "c1", name: "Smoothies", orderCount: 5 }],
        loyaltyProgression: { tier: "Silver" },
        ordersCount: 6,
        totalSpend: 30000,
        churnRisk: 0.2,
        segment: "Loyal Customers",
        preferredOrderHour: 12,
      }),
    } as unknown as jest.Mocked<CustomerIntelligenceService>;

    const inventoryIntelligence = {
      intelligence: jest
        .fn()
        .mockResolvedValue([{ inventoryItemId: "item-1", name: "Mango", wasteProbability: 0.12 }]),
    } as unknown as jest.Mocked<InventoryIntelligenceService>;

    const marketingIntelligence = {
      couponOptimization: jest
        .fn()
        .mockResolvedValue([
          {
            couponId: "c1",
            code: "SAVE10",
            redemptionCount: 40,
            maxRedemptions: 100,
            avgOrderValueWithCoupon: 0,
            avgOrderValueBaseline: 0,
            recommendation: "effective",
          },
        ]),
      referralOptimization: jest.fn().mockResolvedValue({
        totalCodesIssued: 10,
        totalRedemptions: 4,
        conversionRate: 0.4,
        avgRewardCostPerAcquisition: 500,
        topReferrers: [],
      }),
      campaignPerformance: jest
        .fn()
        .mockResolvedValue([
          {
            campaignId: "c1",
            name: "Promo",
            channel: "EMAIL",
            recipientCount: 100,
            sentAt: "2026-01-01",
            estimatedOrderLiftPercent: 20,
          },
        ]),
    } as unknown as jest.Mocked<MarketingIntelligenceService>;

    const service = new FeatureStoreService(
      prisma,
      customerIntelligence,
      inventoryIntelligence,
      marketingIntelligence,
    );
    return { service, prisma, customerIntelligence, inventoryIntelligence, marketingIntelligence };
  }

  it("computes customer features from the customer profile, converting minor units to Birr", async () => {
    const { service } = makeService();
    const features = await service.customerFeatures(actor, "cust-1");

    expect(features.visitFrequencyPerMonth).toBeCloseTo(3, 5); // 30/10
    expect(features.avgOrderValueEtb).toBe(50);
    expect(features.favoriteCategoryCount).toBe(1);
    expect(features.loyaltyLevel).toBe(2); // Silver
    expect(features.churnRisk).toBe(0.2);
  });

  it("computes sales features: weekday/month/holiday flag/weather placeholder", () => {
    const { service } = makeService();
    const features = service.salesFeatures(new Date("2026-09-11T00:00:00Z"), 3);
    expect(features.month).toBe(9);
    expect(features.isHoliday).toBe(true); // Enkutatash
    expect(features.weatherPlaceholder).toBeNull();
    expect(features.activePromotionsCount).toBe(3);
  });

  it("does not flag a non-holiday date", () => {
    const { service } = makeService();
    const features = service.salesFeatures(new Date("2026-03-15T00:00:00Z"), 0);
    expect(features.isHoliday).toBe(false);
  });

  it("computes a positive consumption trend from an increasing daily deduction series", async () => {
    const { service, prisma } = makeService();
    const base = new Date("2026-07-01T12:00:00Z");
    (prisma.inventoryTransaction.findMany as jest.Mock).mockResolvedValue([
      { delta: -5, createdAt: new Date(base.getTime()) },
      { delta: -8, createdAt: new Date(base.getTime() + 24 * 60 * 60 * 1000) },
      { delta: -12, createdAt: new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000) },
    ]);

    const features = await service.inventoryFeatures("item-1");
    expect(features.consumptionTrend).toBeGreaterThan(0);
    expect(features.wastePercent).toBeCloseTo(12, 5);
  });

  it("computes kitchen station features from recent order items", async () => {
    const { service, prisma } = makeService();
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([
      { prepTimeSeconds: 120, quantity: 2 },
      { prepTimeSeconds: 180, quantity: 1 },
    ]);

    const features = await service.kitchenFeatures("station-1");
    expect(features.avgPrepTimeSeconds).toBe(150);
    expect(features.stationLoad).toBe(3);
  });

  it("computes delivery zone features from completed deliveries", async () => {
    const { service, prisma } = makeService();
    const pickedUp = new Date("2026-07-01T12:00:00Z");
    (prisma.delivery.findMany as jest.Mock).mockResolvedValue([
      {
        driverId: "d1",
        pickedUpAt: pickedUp,
        deliveredAt: new Date(pickedUp.getTime() + 20 * 60 * 1000),
      },
      {
        driverId: "d2",
        pickedUpAt: pickedUp,
        deliveredAt: new Date(pickedUp.getTime() + 10 * 60 * 1000),
      },
    ]);

    const features = await service.deliveryFeatures("zone-1");
    expect(features.avgEtaMinutes).toBe(15);
    expect(features.driverUtilization).toBe(1);
  });

  it("computes marketing features from coupon/referral/campaign services", async () => {
    const { service } = makeService();
    const features = await service.marketingFeatures();
    expect(features.couponUsageRate).toBeCloseTo(0.4, 5);
    expect(features.referralConversionRate).toBe(0.4);
    expect(features.campaignRoi).toBeCloseTo(0.2, 5);
  });
});
