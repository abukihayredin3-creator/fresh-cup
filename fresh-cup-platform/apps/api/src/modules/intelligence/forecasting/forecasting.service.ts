import { Injectable, Logger } from "@nestjs/common";
import {
  ForecastGranularity,
  ForecastMetric,
  OrderStatus,
  type ForecastSnapshot,
} from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { ModelRegistryService } from "../ml/model-registry.service";
import { confidenceScore, forecastNextValues, mean, seasonalIndex } from "../ml/stats.util";
import type { HourlyDemandPointDto } from "./dto/forecast-point.dto";

const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

const SALES_MODEL_KEY = "sales-forecast";
const HOURLY_MODEL_KEY = "hourly-demand-forecast";
const PRODUCT_MODEL_KEY = "product-demand-forecast";

const HISTORY_WINDOW_DAYS = 90;
const HORIZON_BY_GRANULARITY: Record<ForecastGranularity, number> = {
  [ForecastGranularity.DAILY]: 14,
  [ForecastGranularity.WEEKLY]: 6,
  [ForecastGranularity.MONTHLY]: 3,
  [ForecastGranularity.HOURLY]: 24,
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday-anchored week
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addPeriod(date: Date, granularity: ForecastGranularity, steps: number): Date {
  const d = new Date(date);
  if (granularity === ForecastGranularity.DAILY) d.setDate(d.getDate() + steps);
  else if (granularity === ForecastGranularity.WEEKLY) d.setDate(d.getDate() + steps * 7);
  else if (granularity === ForecastGranularity.MONTHLY) d.setMonth(d.getMonth() + steps);
  else d.setHours(d.getHours() + steps);
  return d;
}

function periodStartFor(date: Date, granularity: ForecastGranularity): Date {
  if (granularity === ForecastGranularity.DAILY) return startOfDay(date);
  if (granularity === ForecastGranularity.WEEKLY) return startOfWeek(date);
  if (granularity === ForecastGranularity.MONTHLY) return startOfMonth(date);
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/**
 * Hand-rolled forecasting: trailing history bucketed by granularity, fed
 * through the shared moving-average/linear-regression blend in
 * ml/stats.util.ts. Every generated point is persisted as a
 * ForecastSnapshot tied to a versioned MlModelRun — this is what makes the
 * model "replaceable" (swap this class's internals, the version bumps,
 * old snapshots stay attributable to the old version) without adding a
 * training pipeline or external ML service.
 */
@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  /** Backfills `actualValue` on past snapshots whose target period has already elapsed. */
  async backfillActuals(): Promise<number> {
    const pending = await this.prisma.forecastSnapshot.findMany({
      where: { actualValue: null, targetPeriodStart: { lt: new Date() } },
      take: 500,
    });
    let updated = 0;
    for (const snapshot of pending) {
      const actual = await this.actualValueFor(snapshot);
      if (actual === null) continue;
      await this.prisma.forecastSnapshot.update({
        where: { id: snapshot.id },
        data: { actualValue: actual },
      });
      updated++;
    }
    return updated;
  }

  private async actualValueFor(snapshot: ForecastSnapshot): Promise<number | null> {
    const periodEnd = addPeriod(snapshot.targetPeriodStart, snapshot.granularity, 1);
    if (periodEnd > new Date()) return null;

    const branchWhere = snapshot.branchId ? { branchId: snapshot.branchId } : {};
    if (
      snapshot.metric === ForecastMetric.SALES_REVENUE ||
      snapshot.metric === ForecastMetric.SALES_ORDERS
    ) {
      const agg = await this.prisma.order.aggregate({
        where: {
          ...branchWhere,
          status: { in: COUNTED_STATUSES },
          placedAt: { gte: snapshot.targetPeriodStart, lt: periodEnd },
        },
        _sum: { total: true },
        _count: true,
      });
      return snapshot.metric === ForecastMetric.SALES_REVENUE ? (agg._sum.total ?? 0) : agg._count;
    }
    if (snapshot.metric === ForecastMetric.PRODUCT_DEMAND && snapshot.menuItemId) {
      const agg = await this.prisma.orderItem.aggregate({
        where: {
          menuItemId: snapshot.menuItemId,
          order: {
            ...branchWhere,
            status: { in: COUNTED_STATUSES },
            placedAt: { gte: snapshot.targetPeriodStart, lt: periodEnd },
          },
        },
        _sum: { quantity: true },
      });
      return agg._sum.quantity ?? 0;
    }
    if (snapshot.metric === ForecastMetric.HOURLY_DEMAND) {
      const count = await this.prisma.order.count({
        where: {
          ...branchWhere,
          status: { in: COUNTED_STATUSES },
          placedAt: { gte: snapshot.targetPeriodStart, lt: periodEnd },
        },
      });
      return count;
    }
    return null;
  }

  /** Daily/weekly/monthly revenue + order-count forecast, optionally scoped to a branch. */
  async generateSalesForecast(
    branchId: string | undefined,
    granularity: ForecastGranularity,
  ): Promise<void> {
    const windowDays =
      granularity === ForecastGranularity.MONTHLY
        ? 365
        : granularity === ForecastGranularity.WEEKLY
          ? 182
          : HISTORY_WINDOW_DAYS;
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: { in: COUNTED_STATUSES },
        placedAt: { gte: windowStart },
      },
      select: { total: true, placedAt: true },
    });

    const buckets = new Map<string, { revenue: number; count: number; periodStart: Date }>();
    for (const order of orders) {
      const periodStart = periodStartFor(order.placedAt, granularity);
      const key = periodStart.toISOString();
      const bucket = buckets.get(key) ?? { revenue: 0, count: 0, periodStart };
      bucket.revenue += order.total;
      bucket.count += 1;
      buckets.set(key, bucket);
    }

    const sortedKeys = Array.from(buckets.keys()).sort();
    if (sortedKeys.length < 2) {
      this.logger.warn(
        `Not enough history to forecast sales (${granularity}, branch=${branchId ?? "all"}) — skipping`,
      );
      return;
    }

    const revenueHistory = sortedKeys.map((k) => buckets.get(k)!.revenue);
    const countHistory = sortedKeys.map((k) => buckets.get(k)!.count);
    const lastPeriodStart = buckets.get(sortedKeys[sortedKeys.length - 1]!)!.periodStart;
    const horizon = HORIZON_BY_GRANULARITY[granularity];

    const revenuePredictions = forecastNextValues(revenueHistory, horizon);
    const orderPredictions = forecastNextValues(countHistory, horizon);
    const confidence = confidenceScore(revenueHistory);

    const dowIndex = granularity === ForecastGranularity.DAILY ? this.dayOfWeekIndex(orders) : null;

    const modelRun = await this.modelRegistry.recordRun(
      `${SALES_MODEL_KEY}-${granularity.toLowerCase()}${branchId ? `-${branchId}` : ""}`,
      {
        metrics: { historyPoints: sortedKeys.length, confidence },
        notes: `Linear-regression + trailing-average blend over ${sortedKeys.length} ${granularity.toLowerCase()} buckets`,
      },
    );

    const rows: {
      modelRunId: string;
      metric: ForecastMetric;
      granularity: ForecastGranularity;
      targetPeriodStart: Date;
      branchId: string | null;
      predictedValue: number;
      confidence: number;
    }[] = [];

    for (let step = 1; step <= horizon; step++) {
      const targetPeriodStart = addPeriod(lastPeriodStart, granularity, step);
      const seasonalMultiplier = dowIndex
        ? Math.min(1.5, Math.max(0.5, dowIndex.get(targetPeriodStart.getDay()) ?? 1))
        : 1;
      rows.push({
        modelRunId: modelRun.id,
        metric: ForecastMetric.SALES_REVENUE,
        granularity,
        targetPeriodStart,
        branchId: branchId ?? null,
        predictedValue: Math.round(revenuePredictions[step - 1]! * seasonalMultiplier),
        confidence,
      });
      rows.push({
        modelRunId: modelRun.id,
        metric: ForecastMetric.SALES_ORDERS,
        granularity,
        targetPeriodStart,
        branchId: branchId ?? null,
        predictedValue: Math.max(0, Math.round(orderPredictions[step - 1]! * seasonalMultiplier)),
        confidence,
      });
    }

    await this.prisma.forecastSnapshot.createMany({ data: rows });
  }

  /** Day-of-week seasonal index (0=Sunday..6=Saturday) from daily revenue — used to adjust daily forecasts. */
  private dayOfWeekIndex(orders: { total: number; placedAt: Date }[]): Map<number, number> {
    const byDow = new Map<number, number[]>();
    const byDayTotal = new Map<string, number>();
    for (const order of orders) {
      const dateKey = startOfDay(order.placedAt).toISOString();
      byDayTotal.set(dateKey, (byDayTotal.get(dateKey) ?? 0) + order.total);
    }
    for (const [dateKey, total] of byDayTotal.entries()) {
      const dow = new Date(dateKey).getDay();
      const list = byDow.get(dow) ?? [];
      list.push(total);
      byDow.set(dow, list);
    }
    return seasonalIndex(byDow);
  }

  /** Expected order volume per hour-of-day for the next 24 hours, from trailing 30-day hourly seasonality. */
  async generateHourlyDemandForecast(branchId: string | undefined): Promise<void> {
    const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: { in: COUNTED_STATUSES },
        placedAt: { gte: windowStart },
      },
      select: { placedAt: true },
    });
    if (orders.length === 0) return;

    const byHourByDay = new Map<number, Map<string, number>>();
    for (const order of orders) {
      const hour = order.placedAt.getHours();
      const dayKey = startOfDay(order.placedAt).toISOString();
      const dayMap = byHourByDay.get(hour) ?? new Map<string, number>();
      dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1);
      byHourByDay.set(hour, dayMap);
    }

    const byHour = new Map<number, number[]>();
    for (const [hour, dayMap] of byHourByDay.entries()) {
      byHour.set(hour, Array.from(dayMap.values()));
    }
    const index = seasonalIndex(byHour);
    const dailyAvg = mean(orders.length > 0 ? [orders.length / 30] : [0]);

    const modelRun = await this.modelRegistry.recordRun(
      `${HOURLY_MODEL_KEY}${branchId ? `-${branchId}` : ""}`,
      { metrics: { historyOrders: orders.length } },
    );

    const tomorrow = startOfDay(addPeriod(new Date(), ForecastGranularity.DAILY, 1));
    const rows = Array.from({ length: 24 }, (_, hour) => {
      const idx = index.get(hour) ?? 1;
      return {
        modelRunId: modelRun.id,
        metric: ForecastMetric.HOURLY_DEMAND,
        granularity: ForecastGranularity.HOURLY,
        targetPeriodStart: addPeriod(tomorrow, ForecastGranularity.HOURLY, hour),
        branchId: branchId ?? null,
        predictedValue: Math.max(0, Math.round(dailyAvg * idx)),
        confidence: confidenceScore(Array.from(byHourByDay.get(hour)?.values() ?? [])),
      };
    });
    await this.prisma.forecastSnapshot.createMany({ data: rows });
  }

  /** Trailing daily-quantity forecast for the top-selling menu items. */
  async generateProductDemandForecast(branchId: string | undefined, topN = 15): Promise<void> {
    const windowStart = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const lines = await this.prisma.orderItem.findMany({
      where: {
        order: {
          ...(branchId ? { branchId } : {}),
          status: { in: COUNTED_STATUSES },
          placedAt: { gte: windowStart },
        },
      },
      select: { menuItemId: true, quantity: true, order: { select: { placedAt: true } } },
    });
    if (lines.length === 0) return;

    const totalByItem = new Map<string, number>();
    for (const line of lines) {
      totalByItem.set(line.menuItemId, (totalByItem.get(line.menuItemId) ?? 0) + line.quantity);
    }
    const topItemIds = Array.from(totalByItem.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([id]) => id);

    const modelRun = await this.modelRegistry.recordRun(
      `${PRODUCT_MODEL_KEY}${branchId ? `-${branchId}` : ""}`,
      { metrics: { itemsForecast: topItemIds.length } },
    );

    const rows: {
      modelRunId: string;
      metric: ForecastMetric;
      granularity: ForecastGranularity;
      targetPeriodStart: Date;
      branchId: string | null;
      menuItemId: string;
      predictedValue: number;
      confidence: number;
    }[] = [];

    for (const menuItemId of topItemIds) {
      const byDay = new Map<string, number>();
      for (const line of lines.filter((l) => l.menuItemId === menuItemId)) {
        const key = startOfDay(line.order.placedAt).toISOString();
        byDay.set(key, (byDay.get(key) ?? 0) + line.quantity);
      }
      const sortedKeys = Array.from(byDay.keys()).sort();
      const history = sortedKeys.map((k) => byDay.get(k)!);
      if (history.length < 2) continue;
      const predictions = forecastNextValues(history, 7);
      const confidence = confidenceScore(history);
      const lastDay = new Date(sortedKeys[sortedKeys.length - 1]!);

      for (let step = 1; step <= 7; step++) {
        rows.push({
          modelRunId: modelRun.id,
          metric: ForecastMetric.PRODUCT_DEMAND,
          granularity: ForecastGranularity.DAILY,
          targetPeriodStart: addPeriod(lastDay, ForecastGranularity.DAILY, step),
          branchId: branchId ?? null,
          menuItemId,
          predictedValue: Math.max(0, Math.round(predictions[step - 1]!)),
          confidence,
        });
      }
    }
    if (rows.length > 0) {
      await this.prisma.forecastSnapshot.createMany({ data: rows });
    }
  }

  /** Runs every forecast generator across every active branch plus the all-branch aggregate. Called by the nightly scheduler and the admin "regenerate" endpoint. */
  async regenerateAll(): Promise<void> {
    const backfilled = await this.backfillActuals();
    this.logger.log(`Backfilled ${backfilled} forecast snapshot(s) with actuals`);

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const scopes: (string | undefined)[] = [undefined, ...branches.map((b) => b.id)];

    for (const branchId of scopes) {
      await this.generateSalesForecast(branchId, ForecastGranularity.DAILY);
      await this.generateSalesForecast(branchId, ForecastGranularity.WEEKLY);
      await this.generateSalesForecast(branchId, ForecastGranularity.MONTHLY);
      await this.generateHourlyDemandForecast(branchId);
      await this.generateProductDemandForecast(branchId);
    }
    this.logger.log(`Regenerated forecasts for ${scopes.length} scope(s)`);
  }

  async series(
    metric: ForecastMetric,
    granularity: ForecastGranularity,
    branchId?: string,
    menuItemId?: string,
  ): Promise<{ modelVersion: number; points: ForecastSnapshot[] }> {
    const snapshots = await this.prisma.forecastSnapshot.findMany({
      where: {
        metric,
        granularity,
        branchId: branchId ?? null,
        menuItemId: menuItemId ?? null,
      },
      orderBy: { targetPeriodStart: "asc" },
      include: { modelRun: { select: { version: true } } },
    });
    return {
      modelVersion: snapshots[0]?.modelRun.version ?? 0,
      points: snapshots,
    };
  }

  async hourlyDemand(branchId?: string): Promise<HourlyDemandPointDto[]> {
    const snapshots = await this.prisma.forecastSnapshot.findMany({
      where: { metric: ForecastMetric.HOURLY_DEMAND, branchId: branchId ?? null },
      orderBy: { targetPeriodStart: "asc" },
    });
    const overallAvg = mean(snapshots.map((s) => Number(s.predictedValue))) || 1;
    return snapshots.map((s) => ({
      hour: s.targetPeriodStart.getHours(),
      predictedOrders: Number(s.predictedValue),
      seasonalIndex: Math.round((Number(s.predictedValue) / overallAvg) * 100) / 100,
    }));
  }

  async productDemand(branchId?: string) {
    const snapshots = await this.prisma.forecastSnapshot.findMany({
      where: {
        metric: ForecastMetric.PRODUCT_DEMAND,
        branchId: branchId ?? null,
        menuItemId: { not: null },
      },
      orderBy: [{ menuItemId: "asc" }, { targetPeriodStart: "asc" }],
      include: { menuItem: { select: { nameEn: true } } },
    });
    const byItem = new Map<string, { nameEn: string; points: ForecastSnapshot[] }>();
    for (const snapshot of snapshots) {
      const key = snapshot.menuItemId!;
      const bucket = byItem.get(key) ?? { nameEn: snapshot.menuItem!.nameEn, points: [] };
      bucket.points.push(snapshot);
      byItem.set(key, bucket);
    }
    return Array.from(byItem.entries()).map(([menuItemId, bucket]) => ({
      menuItemId,
      nameEn: bucket.nameEn,
      points: bucket.points.map((p) => ({
        targetPeriodStart: p.targetPeriodStart.toISOString(),
        predictedValue: Number(p.predictedValue),
        actualValue: p.actualValue !== null ? Number(p.actualValue) : null,
        confidence: Number(p.confidence),
      })),
    }));
  }
}
