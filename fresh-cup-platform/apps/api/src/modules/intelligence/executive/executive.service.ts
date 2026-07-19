import { Injectable } from "@nestjs/common";
import {
  OrderStatus,
  PurchaseOrderStatus,
  InventoryTransactionReason,
  UserRole,
} from "@prisma/client";
import type { DateRangeQueryDto } from "../../analytics/dto/date-range-query.dto";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { ExecutiveOverviewDto } from "./dto/executive-overview.dto";

const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
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
 * The single "everything an owner needs on one screen" endpoint — every
 * figure here is derived on demand from tables Phases 1-5 already own
 * (Order/OrderItem/RecipeIngredient/PurchaseOrder/InventoryTransaction/
 * Coupon/User), plus Phase 6's ForecastSnapshot for forecast-vs-actual.
 * Profit/COGS figures are labeled "estimated" throughout — they're derived
 * from recipe ingredient costs, not an accounting system, and should read
 * as directional, not exact.
 */
@Injectable()
export class ExecutiveService {
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

  async overview(actor: RequestUser, query: DateRangeQueryDto): Promise<ExecutiveOverviewDto> {
    const scopedBranchId = this.resolveBranchScope(actor, query.branchId);
    const { start, end } = this.resolveRange(query.from, query.to);
    const branchWhere = scopedBranchId ? { branchId: scopedBranchId } : {};

    const orders = await this.prisma.order.findMany({
      where: {
        ...branchWhere,
        status: { in: COUNTED_STATUSES },
        placedAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        branchId: true,
        userId: true,
        total: true,
        discountTotal: true,
        couponId: true,
        placedAt: true,
        items: { select: { menuItemId: true, quantity: true, lineTotal: true } },
      },
    });

    const menuItemIds = Array.from(
      new Set(orders.flatMap((o) => o.items.map((i) => i.menuItemId))),
    );
    const cogsByMenuItem = await this.cogsPerUnit(menuItemIds);

    const [
      revenueTrend,
      productProfitability,
      branchComparison,
      customerGrowth,
      peakHours,
      repeatCustomerRate,
      conversionMetrics,
      inventoryCosts,
      marketingRoi,
    ] = await Promise.all([
      this.revenueTrend(orders, cogsByMenuItem),
      this.productProfitability(orders, cogsByMenuItem),
      this.branchComparison(orders),
      this.customerGrowth(start, end),
      this.peakHours(orders),
      this.repeatCustomerRate(orders),
      this.conversionMetrics(scopedBranchId, start, end, orders.length),
      this.inventoryCosts(scopedBranchId, start, end),
      this.marketingRoi(orders),
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalEstimatedProfit = revenueTrend.reduce((sum, p) => sum + p.estimatedProfit, 0);

    return {
      from: toDateKey(start),
      to: toDateKey(end),
      totalRevenue,
      totalEstimatedProfit,
      repeatCustomerRate,
      revenueTrend,
      productProfitability,
      branchComparison,
      customerGrowth,
      peakHours,
      conversionMetrics,
      inventoryCosts,
      marketingRoi,
    };
  }

  private async cogsPerUnit(menuItemIds: string[]): Promise<Map<string, number>> {
    if (menuItemIds.length === 0) return new Map();
    const recipes = await this.prisma.recipeIngredient.findMany({
      where: { menuItemId: { in: menuItemIds } },
      include: { inventoryItem: { select: { unitCost: true } } },
    });
    const cogs = new Map<string, number>();
    for (const recipe of recipes) {
      const cost = Number(recipe.quantityPerUnit) * recipe.inventoryItem.unitCost;
      cogs.set(recipe.menuItemId, (cogs.get(recipe.menuItemId) ?? 0) + cost);
    }
    return cogs;
  }

  private revenueTrend(
    orders: { total: number; placedAt: Date; items: { menuItemId: string; quantity: number }[] }[],
    cogsByMenuItem: Map<string, number>,
  ) {
    const byDay = new Map<string, { revenue: number; cogs: number }>();
    for (const order of orders) {
      const key = toDateKey(order.placedAt);
      const bucket = byDay.get(key) ?? { revenue: 0, cogs: 0 };
      bucket.revenue += order.total;
      for (const item of order.items) {
        bucket.cogs += item.quantity * (cogsByMenuItem.get(item.menuItemId) ?? 0);
      }
      byDay.set(key, bucket);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => ({
        date,
        revenue: bucket.revenue,
        estimatedProfit: Math.round(bucket.revenue - bucket.cogs),
      }));
  }

  private async productProfitability(
    orders: { items: { menuItemId: string; quantity: number; lineTotal: number }[] }[],
    cogsByMenuItem: Map<string, number>,
  ) {
    const byItem = new Map<string, { revenue: number; cogs: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const bucket = byItem.get(item.menuItemId) ?? { revenue: 0, cogs: 0 };
        bucket.revenue += item.lineTotal;
        bucket.cogs += item.quantity * (cogsByMenuItem.get(item.menuItemId) ?? 0);
        byItem.set(item.menuItemId, bucket);
      }
    }
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: Array.from(byItem.keys()) } },
      select: { id: true, nameEn: true },
    });
    const nameById = new Map(menuItems.map((m) => [m.id, m.nameEn]));

    return Array.from(byItem.entries())
      .map(([menuItemId, bucket]) => ({
        menuItemId,
        nameEn: nameById.get(menuItemId) ?? "Unknown",
        revenue: Math.round(bucket.revenue),
        estimatedCogs: Math.round(bucket.cogs),
        estimatedMargin: Math.round(bucket.revenue - bucket.cogs),
      }))
      .sort((a, b) => b.estimatedMargin - a.estimatedMargin)
      .slice(0, 15);
  }

  private async branchComparison(orders: { branchId: string; total: number }[]) {
    const byBranch = new Map<string, { revenue: number; orders: number }>();
    for (const order of orders) {
      const bucket = byBranch.get(order.branchId) ?? { revenue: 0, orders: 0 };
      bucket.revenue += order.total;
      bucket.orders += 1;
      byBranch.set(order.branchId, bucket);
    }
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: Array.from(byBranch.keys()) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(branches.map((b) => [b.id, b.name]));

    return Array.from(byBranch.entries())
      .map(([branchId, bucket]) => ({
        branchId,
        name: nameById.get(branchId) ?? "Unknown",
        revenue: bucket.revenue,
        orders: bucket.orders,
        avgOrderValue: bucket.orders > 0 ? Math.round(bucket.revenue / bucket.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  private async customerGrowth(start: Date, end: Date) {
    const customers = await this.prisma.user.findMany({
      where: { role: UserRole.CUSTOMER, createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    });
    const byDay = new Map<string, number>();
    for (const customer of customers) {
      const key = toDateKey(customer.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, newCustomers]) => ({ date, newCustomers }));
  }

  private peakHours(orders: { placedAt: Date }[]) {
    const byHour = new Map<number, number>();
    for (const order of orders) {
      const hour = order.placedAt.getHours();
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
    return Array.from(byHour.entries())
      .map(([hour, orderCount]) => ({ hour, orderCount }))
      .sort((a, b) => a.hour - b.hour);
  }

  private repeatCustomerRate(orders: { userId: string }[]): number {
    const ordersByUser = new Map<string, number>();
    for (const order of orders) {
      ordersByUser.set(order.userId, (ordersByUser.get(order.userId) ?? 0) + 1);
    }
    if (ordersByUser.size === 0) return 0;
    const repeatCount = Array.from(ordersByUser.values()).filter((count) => count > 1).length;
    return Math.round((repeatCount / ordersByUser.size) * 1000) / 1000;
  }

  private async conversionMetrics(
    branchId: string | undefined,
    start: Date,
    end: Date,
    ordersPlaced: number,
  ) {
    const cartsCreated = await this.prisma.cart.count({
      where: { ...(branchId ? { branchId } : {}), createdAt: { gte: start, lte: end } },
    });
    return {
      cartsCreated,
      ordersPlaced,
      conversionRate:
        cartsCreated > 0 ? Math.round((ordersPlaced / cartsCreated) * 1000) / 1000 : 0,
    };
  }

  private async inventoryCosts(branchId: string | undefined, start: Date, end: Date) {
    const [purchaseLines, wasteTransactions] = await Promise.all([
      this.prisma.purchaseOrderLine.findMany({
        where: {
          purchaseOrder: {
            ...(branchId ? { branchId } : {}),
            status: PurchaseOrderStatus.RECEIVED,
            receivedAt: { gte: start, lte: end },
          },
        },
        select: { quantityReceived: true, unitCost: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          reason: InventoryTransactionReason.WASTE,
          createdAt: { gte: start, lte: end },
          inventoryItem: branchId ? { branchId } : undefined,
        },
        include: { inventoryItem: { select: { unitCost: true } } },
      }),
    ]);

    const purchasingSpend = purchaseLines.reduce(
      (sum, line) => sum + Number(line.quantityReceived ?? 0) * line.unitCost,
      0,
    );
    const wasteCost = wasteTransactions.reduce(
      (sum, tx) => sum + Math.abs(Number(tx.delta)) * tx.inventoryItem.unitCost,
      0,
    );

    return { purchasingSpend: Math.round(purchasingSpend), wasteCost: Math.round(wasteCost) };
  }

  private marketingRoi(
    orders: { total: number; discountTotal: number; couponId: string | null }[],
  ) {
    const couponOrders = orders.filter((o) => o.couponId);
    const couponDiscountGiven = couponOrders.reduce((sum, o) => sum + o.discountTotal, 0);
    const revenueFromCouponOrders = couponOrders.reduce((sum, o) => sum + o.total, 0);
    return {
      couponDiscountGiven,
      revenueFromCouponOrders,
      returnPerDiscountBirr:
        couponDiscountGiven > 0
          ? Math.round((revenueFromCouponOrders / couponDiscountGiven) * 100) / 100
          : null,
    };
  }
}
