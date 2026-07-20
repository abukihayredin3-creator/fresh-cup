import { Injectable } from "@nestjs/common";
import { InventoryTransactionReason, OrderStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { PredictionRequest, PredictionResult } from "../interfaces/ai-brain.interfaces";
import type { PredictionProvider } from "../interfaces/prediction-provider.interface";
import { AiBrainTenantScopeService } from "./ai-brain-tenant-scope.service";
import { buildDailySeries, linearForecast, startOfDay, toDateKey } from "./trend-statistics.util";

/** Orders past the payment gate — same convention as modules/analytics's AnalyticsService. */
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

const TRAILING_DAYS = 14;

/**
 * Phase 9's default PredictionProvider: trailing-average + linear-trend
 * statistics over real Order/InventoryTransaction data — no trained model,
 * per the "do not create fake AI" principle. Every forecast is computed
 * from this organization's own history, never a hardcoded number.
 *
 * Swappable: anything depending on `PredictionProvider` (this interface,
 * not this class) can be rebound to a real ML-backed implementation later
 * without a caller-side change — see prediction-provider.interface.ts.
 */
@Injectable()
export class PredictionEngineService implements PredictionProvider {
  readonly name = "statistical-trend-v1";

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantScope: AiBrainTenantScopeService,
  ) {}

  async predict(request: PredictionRequest): Promise<PredictionResult> {
    const branchIds = await this.tenantScope.resolveBranchIds(
      request.organizationId,
      request.branchId,
    );
    const period = request.period ?? "tomorrow";

    switch (request.metric) {
      case "sales":
        return this.predictSales(branchIds, period);
      case "inventory_demand":
        return this.predictInventoryDemand(branchIds, period);
      case "customer_demand":
        return this.predictCustomerDemand(branchIds, period);
      default:
        return { metric: request.metric, forecast: 0, confidence: 0.2, period };
    }
  }

  private windowStart(): Date {
    const today = startOfDay(new Date());
    return new Date(today.getTime() - (TRAILING_DAYS - 1) * 24 * 60 * 60 * 1000);
  }

  private async predictSales(branchIds: string[], period: string): Promise<PredictionResult> {
    if (branchIds.length === 0) {
      return { metric: "sales", forecast: 0, confidence: 0.2, period };
    }

    const orders = await this.prisma.order.findMany({
      where: {
        branchId: { in: branchIds },
        status: { in: PAID_STATUSES },
        placedAt: { gte: this.windowStart() },
      },
      select: { total: true, placedAt: true },
    });

    const byDay = new Map<string, number>();
    for (const order of orders) {
      const key = toDateKey(order.placedAt);
      byDay.set(key, (byDay.get(key) ?? 0) + order.total);
    }

    const { forecast, confidence } = linearForecast(buildDailySeries(byDay, TRAILING_DAYS));
    return { metric: "sales", forecast, confidence, period };
  }

  private async predictCustomerDemand(
    branchIds: string[],
    period: string,
  ): Promise<PredictionResult> {
    if (branchIds.length === 0) {
      return { metric: "customer_demand", forecast: 0, confidence: 0.2, period };
    }

    const orders = await this.prisma.order.findMany({
      where: {
        branchId: { in: branchIds },
        status: { in: PAID_STATUSES },
        placedAt: { gte: this.windowStart() },
      },
      select: { placedAt: true },
    });

    const byDay = new Map<string, number>();
    for (const order of orders) {
      const key = toDateKey(order.placedAt);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    const { forecast, confidence } = linearForecast(buildDailySeries(byDay, TRAILING_DAYS));
    return { metric: "customer_demand", forecast, confidence, period };
  }

  private async predictInventoryDemand(
    branchIds: string[],
    period: string,
  ): Promise<PredictionResult> {
    if (branchIds.length === 0) {
      return { metric: "inventory_demand", forecast: 0, confidence: 0.2, period };
    }

    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        reason: InventoryTransactionReason.ORDER_DEDUCTION,
        createdAt: { gte: this.windowStart() },
        inventoryItem: { branchId: { in: branchIds } },
      },
      select: { delta: true, createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const tx of transactions) {
      const key = toDateKey(tx.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(Number(tx.delta)));
    }

    const { forecast, confidence } = linearForecast(buildDailySeries(byDay, TRAILING_DAYS));
    return { metric: "inventory_demand", forecast, confidence, period };
  }
}
