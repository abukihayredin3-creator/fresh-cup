import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DeliveryStatus, OrderStatus, Prisma, UserRole } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import type { CustomerAnalyticsResponseDto } from "./dto/customer-analytics-response.dto";
import type { CustomerDetailResponseDto } from "./dto/customer-detail-response.dto";
import type { DashboardResponseDto } from "./dto/dashboard-response.dto";
import type { DateRangeQueryDto } from "./dto/date-range-query.dto";
import type { DeliveryAnalyticsResponseDto } from "./dto/delivery-analytics-response.dto";
import type { DeliveryHeatmapResponseDto } from "./dto/delivery-heatmap-response.dto";
import type { ItemAnalyticsResponseDto } from "./dto/item-analytics-response.dto";
import type { KitchenAnalyticsResponseDto } from "./dto/kitchen-analytics-response.dto";
import type { SalesAnalyticsResponseDto } from "./dto/sales-analytics-response.dto";
import type { TopListQueryDto } from "./dto/top-list-query.dto";

/** Orders past the payment gate — the closest proxy for "counts as revenue" without joining Payment. */
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
];

const PENDING_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.UNASSIGNED,
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.EN_ROUTE,
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * On-demand aggregate queries rather than materialized views or a nightly
 * cron — consistent with the rest of Phase 3's "no new job-scheduler
 * infrastructure" simplification. Fine at restaurant-chain scale; revisit
 * if a single query starts scanning years of order history.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveBranchScope(actor: RequestUser, branchId?: string): string | undefined {
    if (actor.role === UserRole.MANAGER || actor.role === UserRole.STAFF) {
      return actor.branchId ?? "__no_branch__";
    }
    return branchId;
  }

  private resolveRange(from?: string, to?: string): { start: Date; end: Date } {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { start: startOfDay(start), end };
  }

  async dashboard(actor: RequestUser, branchId?: string): Promise<DashboardResponseDto> {
    const scopedBranchId = this.resolveBranchScope(actor, branchId);
    const branchWhere = scopedBranchId ? { branchId: scopedBranchId } : {};
    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [todayAgg, weekAgg, activeOrders, pendingDeliveries, activeItems] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...branchWhere, status: { in: PAID_STATUSES }, placedAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { ...branchWhere, status: { in: PAID_STATUSES }, placedAt: { gte: sevenDaysAgo } },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { ...branchWhere, status: { in: ACTIVE_STATUSES } } }),
      this.prisma.delivery.count({
        where: { ...branchWhere, status: { in: PENDING_DELIVERY_STATUSES } },
      }),
      this.prisma.inventoryItem.findMany({
        where: { ...branchWhere, isActive: true },
        select: { currentStock: true, reorderThreshold: true },
      }),
    ]);

    const lowStockItemCount = activeItems.filter(
      (item) => Number(item.currentStock) <= Number(item.reorderThreshold),
    ).length;

    return {
      todayRevenue: todayAgg._sum.total ?? 0,
      todayOrders: todayAgg._count,
      activeOrders,
      pendingDeliveries,
      lowStockItemCount,
      last7DaysRevenue: weekAgg._sum.total ?? 0,
    };
  }

  async sales(actor: RequestUser, query: DateRangeQueryDto): Promise<SalesAnalyticsResponseDto> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const { start, end } = this.resolveRange(query.from, query.to);

    const orders = await this.prisma.order.findMany({
      where: {
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        status: { in: PAID_STATUSES },
        placedAt: { gte: start, lte: end },
      },
      select: { total: true, placedAt: true },
    });

    const byDayMap = new Map<string, { revenue: number; orders: number }>();
    let totalRevenue = 0;
    for (const order of orders) {
      const key = toDateKey(order.placedAt);
      const bucket = byDayMap.get(key) ?? { revenue: 0, orders: 0 };
      bucket.revenue += order.total;
      bucket.orders += 1;
      byDayMap.set(key, bucket);
      totalRevenue += order.total;
    }

    const byDay = Array.from(byDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({ date, revenue: bucket.revenue, orders: bucket.orders }));

    return {
      from: toDateKey(start),
      to: toDateKey(end),
      totalRevenue,
      totalOrders: orders.length,
      averageOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
      byDay,
    };
  }

  async items(actor: RequestUser, query: TopListQueryDto): Promise<ItemAnalyticsResponseDto> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const { start, end } = this.resolveRange(query.from, query.to);
    const limit = query.limit ?? 10;

    const lines = await this.prisma.orderItem.findMany({
      where: {
        order: {
          ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
          status: { in: PAID_STATUSES },
          placedAt: { gte: start, lte: end },
        },
      },
      select: { menuItemId: true, nameSnapshot: true, quantity: true, lineTotal: true },
    });

    const byItem = new Map<string, { name: string; quantitySold: number; revenue: number }>();
    for (const line of lines) {
      const bucket = byItem.get(line.menuItemId) ?? {
        name: line.nameSnapshot,
        quantitySold: 0,
        revenue: 0,
      };
      bucket.quantitySold += line.quantity;
      bucket.revenue += line.lineTotal;
      byItem.set(line.menuItemId, bucket);
    }

    const items = Array.from(byItem.entries())
      .map(([menuItemId, bucket]) => ({ menuItemId, ...bucket }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return { items };
  }

  async customers(
    actor: RequestUser,
    query: TopListQueryDto,
  ): Promise<CustomerAnalyticsResponseDto> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const { start, end } = this.resolveRange(query.from, query.to);
    const limit = query.limit ?? 10;

    const orders = await this.prisma.order.findMany({
      where: {
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        status: { in: PAID_STATUSES },
        placedAt: { gte: start, lte: end },
      },
      select: { userId: true, total: true },
    });

    const byUser = new Map<string, { ordersCount: number; totalSpend: number }>();
    for (const order of orders) {
      const bucket = byUser.get(order.userId) ?? { ordersCount: 0, totalSpend: 0 };
      bucket.ordersCount += 1;
      bucket.totalSpend += order.total;
      byUser.set(order.userId, bucket);
    }

    const topUserIds = Array.from(byUser.entries())
      .sort(([, a], [, b]) => b.totalSpend - a.totalSpend)
      .slice(0, limit);

    const users = await this.prisma.user.findMany({
      where: { id: { in: topUserIds.map(([userId]) => userId) } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      customers: topUserIds.map(([userId, bucket]) => ({
        userId,
        fullName: nameById.get(userId) ?? "Unknown",
        ordersCount: bucket.ordersCount,
        totalSpend: bucket.totalSpend,
      })),
    };
  }

  async customerDetail(actor: RequestUser, userId: string): Promise<CustomerDetailResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.CUSTOMER) {
      throw new NotFoundException("Customer not found");
    }

    const orderWhere: Prisma.OrderWhereInput = { userId };
    const scopedBranchId = this.resolveBranchScope(actor, undefined);
    if (scopedBranchId) {
      orderWhere.branchId = scopedBranchId;
    }

    const [aggregate, lastOrder, loyalty] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...orderWhere, status: { in: PAID_STATUSES } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.order.findFirst({ where: orderWhere, orderBy: { placedAt: "desc" } }),
      this.prisma.loyaltyLedger.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    ]);

    if (scopedBranchId && aggregate._count === 0) {
      throw new ForbiddenException("This customer has no orders at your branch");
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      createdAt: user.createdAt,
      ordersCount: aggregate._count,
      totalSpend: aggregate._sum.total ?? 0,
      loyaltyBalance: loyalty?.balanceAfter ?? 0,
      lastOrderAt: lastOrder?.placedAt ?? null,
    };
  }

  async kitchenPerformance(
    actor: RequestUser,
    query: DateRangeQueryDto,
  ): Promise<KitchenAnalyticsResponseDto> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const { start, end } = this.resolveRange(query.from, query.to);
    const branchWhere = scopedBranchId ? { branchId: scopedBranchId } : {};

    const orders = await this.prisma.order.findMany({
      where: {
        ...branchWhere,
        placedAt: { gte: start, lte: end },
        preparingAt: { not: null },
        readyAt: { not: null },
      },
      select: { preparingAt: true, readyAt: true },
    });
    const prepDurations = orders.map(
      (o) => (o.readyAt!.getTime() - o.preparingAt!.getTime()) / 1000,
    );
    const avgPrepSeconds =
      prepDurations.length > 0
        ? prepDurations.reduce((sum, d) => sum + d, 0) / prepDurations.length
        : null;

    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { ...branchWhere, placedAt: { gte: start, lte: end } },
        stationId: { not: null },
      },
      select: { stationId: true, prepTimeSeconds: true },
    });
    const stationIds = Array.from(new Set(items.map((i) => i.stationId!)));
    const stations = await this.prisma.kitchenStation.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true },
    });
    const stationNameById = new Map(stations.map((s) => [s.id, s.name]));

    const byStationMap = new Map<string, { itemCount: number; prepSecondsSum: number }>();
    for (const item of items) {
      const bucket = byStationMap.get(item.stationId!) ?? { itemCount: 0, prepSecondsSum: 0 };
      bucket.itemCount += 1;
      bucket.prepSecondsSum += item.prepTimeSeconds;
      byStationMap.set(item.stationId!, bucket);
    }

    const byStation = Array.from(byStationMap.entries())
      .map(([stationId, bucket]) => ({
        stationId,
        stationName: stationNameById.get(stationId) ?? "Unknown",
        itemCount: bucket.itemCount,
        avgEstimatedPrepSeconds: bucket.prepSecondsSum / bucket.itemCount,
      }))
      .sort((a, b) => b.itemCount - a.itemCount);

    return {
      from: toDateKey(start),
      to: toDateKey(end),
      completedOrders: orders.length,
      avgPrepSeconds,
      byStation,
    };
  }

  async deliveryPerformance(
    actor: RequestUser,
    query: DateRangeQueryDto,
  ): Promise<DeliveryAnalyticsResponseDto> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const { start, end } = this.resolveRange(query.from, query.to);

    const deliveries = await this.prisma.delivery.findMany({
      where: {
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        createdAt: { gte: start, lte: end },
      },
      include: { zone: { select: { id: true, name: true } } },
    });

    const completed = deliveries.filter(
      (d) => d.status === DeliveryStatus.DELIVERED && d.assignedAt && d.deliveredAt,
    );
    const durations = completed.map(
      (d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / (60 * 1000),
    );
    const avgDeliveryMinutes =
      durations.length > 0 ? durations.reduce((sum, m) => sum + m, 0) / durations.length : null;

    const byZoneMap = new Map<string, { zoneName: string; feeSum: number; count: number }>();
    for (const delivery of deliveries.filter((d) => d.status === DeliveryStatus.DELIVERED)) {
      const key = delivery.zoneId ?? "__unzoned__";
      const bucket = byZoneMap.get(key) ?? {
        zoneName: delivery.zone?.name ?? "Unzoned",
        feeSum: 0,
        count: 0,
      };
      bucket.feeSum += delivery.fee;
      bucket.count += 1;
      byZoneMap.set(key, bucket);
    }

    const byZone = Array.from(byZoneMap.entries())
      .map(([key, bucket]) => ({
        zoneId: key === "__unzoned__" ? null : key,
        zoneName: bucket.zoneName,
        deliveredCount: bucket.count,
        avgFee: Math.round(bucket.feeSum / bucket.count),
      }))
      .sort((a, b) => b.deliveredCount - a.deliveredCount);

    return {
      from: toDateKey(start),
      to: toDateKey(end),
      totalDeliveries: deliveries.length,
      completedDeliveries: completed.length,
      avgDeliveryMinutes,
      byZone,
    };
  }

  /** Delivered-order drop-off coordinates for a heat-map view — no clustering, left to the frontend. */
  async deliveryHeatmap(
    actor: RequestUser,
    query: DateRangeQueryDto,
  ): Promise<DeliveryHeatmapResponseDto> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const { start, end } = this.resolveRange(query.from, query.to);

    const orders = await this.prisma.order.findMany({
      where: {
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
        placedAt: { gte: start, lte: end },
        deliveryLat: { not: null },
        deliveryLng: { not: null },
      },
      select: { deliveryLat: true, deliveryLng: true },
    });

    return {
      points: orders.map((o) => ({ lat: Number(o.deliveryLat), lng: Number(o.deliveryLng) })),
    };
  }
}
