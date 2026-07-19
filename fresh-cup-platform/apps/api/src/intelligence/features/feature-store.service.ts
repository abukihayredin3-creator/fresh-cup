import { Injectable } from "@nestjs/common";
import { DeliveryStatus, InventoryTransactionReason, PurchaseOrderStatus } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import { CustomerIntelligenceService } from "../../modules/intelligence/customer-intelligence/customer-intelligence.service";
import { InventoryIntelligenceService } from "../../modules/intelligence/inventory-intelligence/inventory-intelligence.service";
import { MarketingIntelligenceService } from "../../modules/intelligence/marketing-intelligence/marketing-intelligence.service";
import { linearRegression, mean } from "../../modules/intelligence/ml/stats.util";
import type {
  CustomerFeatureVector,
  DeliveryFeatureVector,
  InventoryFeatureVector,
  KitchenFeatureVector,
  MarketingFeatureVector,
  SalesFeatureVector,
} from "./dto/feature-vector.dto";

const WINDOW_DAYS = 30;
const LOYALTY_LEVEL: Record<string, number> = { Bronze: 1, Silver: 2, Gold: 3 };

/** Fixed-date Ethiopian public holidays only (movable feasts — Easter, Eid — aren't computed here). */
const FIXED_HOLIDAYS_MONTH_DAY = new Set([
  "1-7", // Genna (Ethiopian Christmas)
  "1-19", // Timkat
  "3-2", // Adwa Victory Day
  "5-1", // Labour Day
  "5-5", // Patriots' Victory Day
  "5-28", // Derg Downfall Day
  "9-11", // Enkutatash (New Year)
  "9-27", // Meskel
]);

/**
 * Reusable feature computation shared across every prediction/forecasting/
 * segmentation model — one place computes a customer's/item's/station's
 * numbers, every model consumes the same vector rather than each
 * re-deriving its own inputs. Delegates to the existing Phase 6 /
 * Phase 11 Part 1 services wherever they already compute the number
 * (customer RFM/churn, inventory waste, marketing ROI); only queries
 * Prisma directly for numbers no existing service exposes (consumption
 * trend slope, per-station/zone raw averages, supplier lead time).
 */
@Injectable()
export class FeatureStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerIntelligence: CustomerIntelligenceService,
    private readonly inventoryIntelligence: InventoryIntelligenceService,
    private readonly marketingIntelligence: MarketingIntelligenceService,
  ) {}

  async customerFeatures(actor: RequestUser, userId: string): Promise<CustomerFeatureVector> {
    const profile = await this.customerIntelligence.customerProfile(actor, userId);
    return {
      userId,
      visitFrequencyPerMonth: profile.purchaseFrequencyDays
        ? 30 / profile.purchaseFrequencyDays
        : 0,
      avgOrderValueEtb: profile.avgOrderValue / 100,
      daysSinceLastVisit: profile.recencyDays,
      favoriteCategoryCount: profile.favoriteCategories.length,
      loyaltyLevel: LOYALTY_LEVEL[profile.loyaltyProgression.tier] ?? 0,
      ordersCount: profile.ordersCount,
      totalSpendEtb: profile.totalSpend / 100,
      churnRisk: profile.churnRisk,
      raw: { segment: profile.segment, preferredOrderHour: profile.preferredOrderHour },
    };
  }

  salesFeatures(date: Date, activePromotionsCount: number): SalesFeatureVector {
    const monthDay = `${date.getMonth() + 1}-${date.getDate()}`;
    return {
      date: date.toISOString().slice(0, 10),
      weekday: date.getDay(),
      month: date.getMonth() + 1,
      isHoliday: FIXED_HOLIDAYS_MONTH_DAY.has(monthDay),
      weatherPlaceholder: null,
      activePromotionsCount,
      raw: {},
    };
  }

  async activePromotionsCount(on: Date): Promise<number> {
    const [coupons, campaigns] = await Promise.all([
      this.prisma.coupon.count({
        where: {
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: on } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: on } }] }],
        },
      }),
      this.prisma.campaign.count({
        where: { sentAt: { not: null, gte: new Date(on.getTime() - 3 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return coupons + campaigns;
  }

  async inventoryFeatures(
    inventoryItemId: string,
    branchId?: string,
  ): Promise<InventoryFeatureVector> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const deductions = await this.prisma.inventoryTransaction.findMany({
      where: {
        inventoryItemId,
        reason: InventoryTransactionReason.ORDER_DEDUCTION,
        createdAt: { gte: since },
      },
      select: { delta: true, createdAt: true },
    });
    const byDay = new Map<string, number>();
    for (const tx of deductions) {
      const key = tx.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(Number(tx.delta)));
    }
    const dailySeries = Array.from(byDay.values());
    const consumptionTrend = dailySeries.length >= 2 ? linearRegression(dailySeries).slope : 0;

    const lines = await this.prisma.purchaseOrderLine.findMany({
      where: {
        inventoryItemId,
        purchaseOrder: {
          status: PurchaseOrderStatus.RECEIVED,
          submittedAt: { not: null },
          receivedAt: { not: null },
        },
      },
      include: { purchaseOrder: { select: { submittedAt: true, receivedAt: true } } },
    });
    const leadTimesDays = lines.map(
      (l) =>
        (l.purchaseOrder.receivedAt!.getTime() - l.purchaseOrder.submittedAt!.getTime()) /
        (24 * 60 * 60 * 1000),
    );

    const items = await this.inventoryIntelligence.intelligence(branchId);
    const item = items.find((i) => i.inventoryItemId === inventoryItemId);

    return {
      inventoryItemId,
      consumptionTrend,
      avgSupplierDelayDays: leadTimesDays.length ? Math.round(mean(leadTimesDays) * 10) / 10 : 0,
      wastePercent: item ? Math.round(item.wasteProbability * 1000) / 10 : 0,
      raw: { name: item?.name },
    };
  }

  async kitchenFeatures(stationId: string): Promise<KitchenFeatureVector> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const items = await this.prisma.orderItem.findMany({
      where: { stationId, createdAt: { gte: since } },
      select: { prepTimeSeconds: true, quantity: true },
    });
    const station = await this.prisma.kitchenStation.findUnique({ where: { id: stationId } });

    return {
      stationId,
      avgPrepTimeSeconds: items.length ? Math.round(mean(items.map((i) => i.prepTimeSeconds))) : 0,
      stationLoad: items.reduce((sum, i) => sum + i.quantity, 0),
      raw: { name: station?.name },
    };
  }

  async deliveryFeatures(zoneId: string): Promise<DeliveryFeatureVector> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const deliveries = await this.prisma.delivery.findMany({
      where: {
        zoneId,
        status: DeliveryStatus.DELIVERED,
        pickedUpAt: { not: null },
        deliveredAt: { gte: since },
      },
      select: { driverId: true, pickedUpAt: true, deliveredAt: true },
    });
    const durations = deliveries
      .filter((d) => d.pickedUpAt)
      .map((d) => (d.deliveredAt!.getTime() - d.pickedUpAt!.getTime()) / (1000 * 60));
    const distinctDrivers = new Set(deliveries.map((d) => d.driverId).filter(Boolean)).size;

    const zone = await this.prisma.deliveryZone.findUnique({ where: { id: zoneId } });

    return {
      zoneId,
      avgEtaMinutes: durations.length ? Math.round(mean(durations)) : 0,
      driverUtilization:
        distinctDrivers > 0 ? Math.round((deliveries.length / distinctDrivers) * 10) / 10 : 0,
      raw: { name: zone?.name },
    };
  }

  async marketingFeatures(): Promise<MarketingFeatureVector> {
    const [coupons, referral, campaigns] = await Promise.all([
      this.marketingIntelligence.couponOptimization(),
      this.marketingIntelligence.referralOptimization(),
      this.marketingIntelligence.campaignPerformance(),
    ]);
    const capped = coupons.filter((c) => c.maxRedemptions !== null && c.maxRedemptions > 0);
    const couponUsageRate = capped.length
      ? mean(capped.map((c) => Math.min(1, c.redemptionCount / c.maxRedemptions!)))
      : 0;
    const lifts = campaigns
      .map((c) => c.estimatedOrderLiftPercent)
      .filter((lift): lift is number => lift !== null);

    return {
      couponUsageRate: Math.round(couponUsageRate * 1000) / 1000,
      referralConversionRate: referral.conversionRate,
      campaignRoi: lifts.length ? Math.round(mean(lifts)) / 100 : 0,
      raw: {},
    };
  }
}
