import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, PaymentStatus, UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import { quantileScore } from "../ml/stats.util";
import type {
  CouponEffectivenessDto,
  CustomerIntelligenceProfileDto,
  FavoriteCategoryDto,
  LoyaltyProgressionDto,
} from "./dto/customer-intelligence-profile.dto";
import type { CustomerSegmentDto, SegmentSummaryEntryDto } from "./dto/customer-segment.dto";
import type { ListSegmentsQueryDto } from "./dto/list-segments-query.dto";

const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface CustomerAggregate {
  userId: string;
  fullName: string;
  ordersCount: number;
  totalSpend: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
}

function daysSince(date: Date): number {
  return Math.max(0, (Date.now() - date.getTime()) / MS_PER_DAY);
}

function segmentFor(r: number, f: number, m: number): string {
  if (r >= 4 && f >= 4 && m >= 4) return "Champions";
  if (r >= 3 && f >= 3) return "Loyal Customers";
  if (r >= 4 && f <= 2) return "New Customers";
  if (r <= 2 && f >= 3) return "At Risk";
  if (r <= 2 && f <= 2) return "Lost";
  return "Need Attention";
}

/**
 * Every metric here is computed on demand from Order/OrderItem/LoyaltyLedger/
 * Payment — no persisted "customer score" table, same on-demand-aggregate
 * approach as AnalyticsService. RFM scoring is quintile-based against the
 * current customer population (recomputed on each call), which is why
 * segments can shift day to day as order volume changes — that's the
 * correct behavior for RFM, not a bug to cache away.
 */
@Injectable()
export class CustomerIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveBranchScope(actor: RequestUser, branchId?: string): string | undefined {
    if (actor.role === UserRole.MANAGER || actor.role === UserRole.STAFF) {
      return actor.branchId ?? "__no_branch__";
    }
    return branchId;
  }

  private async customerAggregates(branchId?: string): Promise<CustomerAggregate[]> {
    const orders = await this.prisma.order.findMany({
      where: { ...(branchId ? { branchId } : {}), status: { in: COUNTED_STATUSES } },
      select: { userId: true, total: true, placedAt: true },
    });
    if (orders.length === 0) return [];

    const byUser = new Map<
      string,
      { ordersCount: number; totalSpend: number; first: Date; last: Date }
    >();
    for (const order of orders) {
      const bucket = byUser.get(order.userId);
      if (bucket) {
        bucket.ordersCount += 1;
        bucket.totalSpend += order.total;
        if (order.placedAt < bucket.first) bucket.first = order.placedAt;
        if (order.placedAt > bucket.last) bucket.last = order.placedAt;
      } else {
        byUser.set(order.userId, {
          ordersCount: 1,
          totalSpend: order.total,
          first: order.placedAt,
          last: order.placedAt,
        });
      }
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(byUser.keys()) } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    return Array.from(byUser.entries()).map(([userId, bucket]) => ({
      userId,
      fullName: nameById.get(userId) ?? "Unknown",
      ordersCount: bucket.ordersCount,
      totalSpend: bucket.totalSpend,
      firstOrderAt: bucket.first,
      lastOrderAt: bucket.last,
    }));
  }

  private churnRiskFor(aggregate: CustomerAggregate): number {
    const recency = daysSince(aggregate.lastOrderAt);
    if (aggregate.ordersCount < 2) {
      return Math.min(1, recency / 60);
    }
    const spanDays =
      (aggregate.lastOrderAt.getTime() - aggregate.firstOrderAt.getTime()) / MS_PER_DAY;
    const avgIntervalDays = Math.max(1, spanDays / (aggregate.ordersCount - 1));
    return Math.round(Math.min(1, recency / (avgIntervalDays * 2)) * 1000) / 1000;
  }

  private ltvFor(aggregate: CustomerAggregate, churnRisk: number): number {
    const avgOrderValue = aggregate.totalSpend / aggregate.ordersCount;
    const accountAgeDays = Math.max(1, daysSince(aggregate.firstOrderAt));
    const purchasesPerYear = aggregate.ordersCount / Math.max(1, accountAgeDays / 365);
    const estimatedLifespanYears = Math.min(5, 1 / Math.max(0.05, churnRisk));
    return Math.round(avgOrderValue * purchasesPerYear * estimatedLifespanYears);
  }

  private scoreAll(aggregates: CustomerAggregate[]): CustomerSegmentDto[] {
    const recencyDaysAsc = aggregates.map((a) => daysSince(a.lastOrderAt)).sort((a, b) => a - b);
    const frequencyAsc = aggregates.map((a) => a.ordersCount).sort((a, b) => a - b);
    const monetaryAsc = aggregates.map((a) => a.totalSpend).sort((a, b) => a - b);

    return aggregates.map((aggregate) => {
      const recencyDays = daysSince(aggregate.lastOrderAt);
      const r = quantileScore(recencyDaysAsc, recencyDays, false);
      const f = quantileScore(frequencyAsc, aggregate.ordersCount, true);
      const m = quantileScore(monetaryAsc, aggregate.totalSpend, true);
      const churnRisk = this.churnRiskFor(aggregate);

      return {
        userId: aggregate.userId,
        fullName: aggregate.fullName,
        recencyDays: Math.round(recencyDays),
        ordersCount: aggregate.ordersCount,
        totalSpend: aggregate.totalSpend,
        rfm: { recency: r, frequency: f, monetary: m },
        segment: segmentFor(r, f, m),
        churnRisk,
        predictedLtv: this.ltvFor(aggregate, churnRisk),
      };
    });
  }

  async segments(actor: RequestUser, query: ListSegmentsQueryDto): Promise<CustomerSegmentDto[]> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const aggregates = await this.customerAggregates(scopedBranchId);
    let scored = this.scoreAll(aggregates).sort((a, b) => b.totalSpend - a.totalSpend);
    if (query.segment) {
      scored = scored.filter((c) => c.segment === query.segment);
    }
    return scored.slice(0, query.limit ?? 50);
  }

  async segmentSummary(actor: RequestUser, branchId?: string): Promise<SegmentSummaryEntryDto[]> {
    const scopedBranchId = this.resolveBranchScope(actor, branchId);
    const aggregates = await this.customerAggregates(scopedBranchId);
    const scored = this.scoreAll(aggregates);

    const bySegment = new Map<string, { customerCount: number; totalSpend: number }>();
    for (const customer of scored) {
      const bucket = bySegment.get(customer.segment) ?? { customerCount: 0, totalSpend: 0 };
      bucket.customerCount += 1;
      bucket.totalSpend += customer.totalSpend;
      bySegment.set(customer.segment, bucket);
    }
    return Array.from(bySegment.entries())
      .map(([segment, bucket]) => ({ segment, ...bucket }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }

  async customerProfile(
    actor: RequestUser,
    userId: string,
  ): Promise<CustomerIntelligenceProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.CUSTOMER) {
      throw new NotFoundException("Customer not found");
    }

    const scopedBranchId = this.resolveBranchScope(actor, undefined);
    const orderWhere = {
      userId,
      status: { in: COUNTED_STATUSES },
      ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
    };

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      select: { id: true, total: true, placedAt: true, couponId: true },
    });
    if (orders.length === 0) {
      throw new NotFoundException("This customer has no qualifying orders in scope");
    }

    const aggregate: CustomerAggregate = {
      userId,
      fullName: user.fullName,
      ordersCount: orders.length,
      totalSpend: orders.reduce((sum, o) => sum + o.total, 0),
      firstOrderAt: orders.reduce(
        (min, o) => (o.placedAt < min ? o.placedAt : min),
        orders[0]!.placedAt,
      ),
      lastOrderAt: orders.reduce(
        (max, o) => (o.placedAt > max ? o.placedAt : max),
        orders[0]!.placedAt,
      ),
    };

    const population = await this.customerAggregates(scopedBranchId);
    const recencyDaysAsc = population.map((a) => daysSince(a.lastOrderAt)).sort((a, b) => a - b);
    const frequencyAsc = population.map((a) => a.ordersCount).sort((a, b) => a - b);
    const monetaryAsc = population.map((a) => a.totalSpend).sort((a, b) => a - b);

    const recencyDays = daysSince(aggregate.lastOrderAt);
    const r = quantileScore(recencyDaysAsc, recencyDays, false);
    const f = quantileScore(frequencyAsc, aggregate.ordersCount, true);
    const m = quantileScore(monetaryAsc, aggregate.totalSpend, true);
    const churnRisk = this.churnRiskFor(aggregate);

    const purchaseFrequencyDays =
      aggregate.ordersCount >= 2
        ? Math.round(
            ((aggregate.lastOrderAt.getTime() - aggregate.firstOrderAt.getTime()) /
              MS_PER_DAY /
              (aggregate.ordersCount - 1)) *
              10,
          ) / 10
        : null;

    const [favoriteCategories, preferredOrderHour, preferredPaymentMethod, loyaltyProgression] =
      await Promise.all([
        this.favoriteCategories(orders.map((o) => o.id)),
        this.preferredOrderHour(orders.map((o) => o.placedAt)),
        this.preferredPaymentMethod(orders.map((o) => o.id)),
        this.loyaltyProgression(userId),
      ]);

    const couponOrders = orders.filter((o) => o.couponId);
    const nonCouponOrders = orders.filter((o) => !o.couponId);
    const couponEffectiveness: CouponEffectivenessDto = {
      ordersWithCoupon: couponOrders.length,
      ordersWithoutCoupon: nonCouponOrders.length,
      avgOrderValueWithCoupon:
        couponOrders.length > 0
          ? Math.round(couponOrders.reduce((sum, o) => sum + o.total, 0) / couponOrders.length)
          : 0,
      avgOrderValueWithoutCoupon:
        nonCouponOrders.length > 0
          ? Math.round(
              nonCouponOrders.reduce((sum, o) => sum + o.total, 0) / nonCouponOrders.length,
            )
          : 0,
    };

    return {
      userId,
      fullName: user.fullName,
      recencyDays: Math.round(recencyDays),
      ordersCount: aggregate.ordersCount,
      totalSpend: aggregate.totalSpend,
      avgOrderValue: Math.round(aggregate.totalSpend / aggregate.ordersCount),
      purchaseFrequencyDays,
      rfm: { recency: r, frequency: f, monetary: m },
      segment: segmentFor(r, f, m),
      churnRisk,
      predictedLtv: this.ltvFor(aggregate, churnRisk),
      favoriteCategories,
      preferredOrderHour,
      preferredPaymentMethod,
      couponEffectiveness,
      loyaltyProgression,
    };
  }

  private async favoriteCategories(orderIds: string[]): Promise<FavoriteCategoryDto[]> {
    const lines = await this.prisma.orderItem.findMany({
      where: { orderId: { in: orderIds } },
      select: {
        menuItem: { select: { categoryId: true, category: { select: { nameEn: true } } } },
      },
    });
    const byCategory = new Map<string, { name: string; count: number }>();
    for (const line of lines) {
      const key = line.menuItem.categoryId;
      const bucket = byCategory.get(key) ?? { name: line.menuItem.category.nameEn, count: 0 };
      bucket.count += 1;
      byCategory.set(key, bucket);
    }
    return Array.from(byCategory.entries())
      .map(([categoryId, bucket]) => ({ categoryId, name: bucket.name, orderCount: bucket.count }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5);
  }

  private preferredOrderHour(placedAts: Date[]): number | null {
    if (placedAts.length === 0) return null;
    const counts = new Map<number, number>();
    for (const date of placedAts) {
      const hour = date.getHours();
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([, a], [, b]) => b - a)[0]![0];
  }

  private async preferredPaymentMethod(orderIds: string[]): Promise<string | null> {
    const payments = await this.prisma.payment.findMany({
      where: { orderId: { in: orderIds }, status: PaymentStatus.SUCCEEDED },
      select: { method: true },
    });
    if (payments.length === 0) return null;
    const counts = new Map<string, number>();
    for (const payment of payments) {
      counts.set(payment.method, (counts.get(payment.method) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([, a], [, b]) => b - a)[0]![0];
  }

  private async loyaltyProgression(userId: string): Promise<LoyaltyProgressionDto> {
    const [latest, earned] = await Promise.all([
      this.prisma.loyaltyLedger.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.loyaltyLedger.aggregate({
        where: { userId, pointsDelta: { gt: 0 } },
        _sum: { pointsDelta: true },
      }),
    ]);
    const lifetimeEarned = earned._sum.pointsDelta ?? 0;

    const tiers: { name: string; threshold: number }[] = [
      { name: "Bronze", threshold: 0 },
      { name: "Silver", threshold: 500 },
      { name: "Gold", threshold: 2000 },
    ];
    let tier = tiers[0]!.name;
    let nextThreshold: number | null = tiers[1]!.threshold;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (lifetimeEarned >= tiers[i]!.threshold) {
        tier = tiers[i]!.name;
        nextThreshold = tiers[i + 1]?.threshold ?? null;
        break;
      }
    }

    return {
      currentBalance: latest?.balanceAfter ?? 0,
      lifetimeEarned,
      tier,
      pointsToNextTier: nextThreshold !== null ? Math.max(0, nextThreshold - lifetimeEarned) : null,
    };
  }
}
