import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { mean, stdDev } from "../../../modules/intelligence/ml/stats.util";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { ExplanationService } from "../explanation.service";

const WINDOW_DAYS = 30;
/** An order's actual prep time exceeding its slowest item's estimate by this ratio counts as a bottleneck. */
const BOTTLENECK_OVERRUN_RATIO = 1.3;

interface CompletedOrder {
  id: string;
  preparingAt: Date;
  readyAt: Date;
  items: { stationId: string | null; prepTimeSeconds: number; quantity: number }[];
}

/**
 * Net-new — Phase 6 had no kitchen-operations intelligence. Built directly
 * from Order.preparingAt/readyAt (already recorded by the ordering
 * workflow since Phase 2/3) and OrderItem.stationId/prepTimeSeconds
 * (snapshotted at order time — see the schema comment on OrderItem), no
 * new columns needed.
 */
@Injectable()
export class KitchenAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly explanation: ExplanationService,
  ) {}

  private async completedOrders(branchId?: string): Promise<CompletedOrder[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        preparingAt: { not: null, gte: since },
        readyAt: { not: null },
      },
      select: {
        id: true,
        preparingAt: true,
        readyAt: true,
        items: { select: { stationId: true, prepTimeSeconds: true, quantity: true } },
      },
    });
    return orders as CompletedOrder[];
  }

  async prepBottlenecks(branchId?: string): Promise<AiInsightDto[]> {
    const orders = await this.completedOrders(branchId);
    const byStation = new Map<string, { bottleneckCount: number; overrunRatios: number[] }>();

    for (const order of orders) {
      if (order.items.length === 0) continue;
      const actualSeconds = (order.readyAt.getTime() - order.preparingAt.getTime()) / 1000;
      const slowestItem = order.items.reduce((a, b) =>
        b.prepTimeSeconds > a.prepTimeSeconds ? b : a,
      );
      if (!slowestItem.stationId || slowestItem.prepTimeSeconds === 0) continue;

      const overrunRatio = actualSeconds / slowestItem.prepTimeSeconds;
      if (overrunRatio >= BOTTLENECK_OVERRUN_RATIO) {
        const bucket = byStation.get(slowestItem.stationId) ?? {
          bottleneckCount: 0,
          overrunRatios: [],
        };
        bucket.bottleneckCount += 1;
        bucket.overrunRatios.push(overrunRatio);
        byStation.set(slowestItem.stationId, bucket);
      }
    }

    const stationIds = Array.from(byStation.keys());
    const stations = await this.prisma.kitchenStation.findMany({
      where: { id: { in: stationIds } },
    });
    const nameById = new Map(stations.map((s) => [s.id, s.name]));

    return Promise.all(
      Array.from(byStation.entries()).map(async ([stationId, bucket]) => {
        const name = nameById.get(stationId) ?? "Unknown station";
        const dataPoints = {
          bottleneckOrderCount: bucket.bottleneckCount,
          avgOverrunPercent: Math.round((mean(bucket.overrunRatios) - 1) * 100),
        };
        return {
          title: `Prep bottleneck: ${name}`,
          explanation: await this.explanation.explain(`Prep bottleneck at ${name}`, dataPoints),
          confidence: confidenceScore(bucket.overrunRatios),
          data: dataPoints,
        };
      }),
    );
  }

  async stationWorkload(branchId?: string): Promise<AiInsightDto[]> {
    const orders = await this.completedOrders(branchId);
    const byStation = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        if (!item.stationId) continue;
        byStation.set(item.stationId, (byStation.get(item.stationId) ?? 0) + item.quantity);
      }
    }

    const stationIds = Array.from(byStation.keys());
    const stations = await this.prisma.kitchenStation.findMany({
      where: { id: { in: stationIds } },
    });
    const nameById = new Map(stations.map((s) => [s.id, s.name]));
    const volumes = Array.from(byStation.values());

    return Promise.all(
      Array.from(byStation.entries()).map(async ([stationId, itemsPrepared]) => {
        const name = nameById.get(stationId) ?? "Unknown station";
        const dataPoints = { itemsPreparedLast30Days: itemsPrepared };
        return {
          title: `Station workload: ${name}`,
          explanation: await this.explanation.explain(`Station workload for ${name}`, dataPoints),
          confidence: confidenceScore(volumes),
          data: dataPoints,
        };
      }),
    );
  }

  async prepTimeAnomalies(branchId?: string): Promise<AiInsightDto[]> {
    const orders = await this.completedOrders(branchId);
    const withDuration = orders.map((order) => ({
      order,
      durationSeconds: (order.readyAt.getTime() - order.preparingAt.getTime()) / 1000,
    }));
    if (withDuration.length < 2) return [];

    const durations = withDuration.map((w) => w.durationSeconds);
    const avg = mean(durations);
    const sd = stdDev(durations);
    if (sd === 0) return [];
    const threshold = avg + 2 * sd;

    const anomalies = withDuration.filter((w) => w.durationSeconds > threshold);
    return Promise.all(
      anomalies.map(async ({ order, durationSeconds }) => {
        const dataPoints = {
          orderId: order.id,
          actualPrepMinutes: Math.round(durationSeconds / 60),
          expectedPrepMinutes: Math.round(avg / 60),
        };
        return {
          title: `Prep-time anomaly: order ${order.id.slice(0, 8)}`,
          explanation: await this.explanation.explain("Prep-time anomaly", dataPoints),
          confidence: confidenceScore(durations),
          data: dataPoints,
        };
      }),
    );
  }

  async efficiencyRecommendations(branchId?: string): Promise<AiInsightDto[]> {
    const bottlenecks = await this.prepBottlenecks(branchId);
    return bottlenecks
      .filter((b) => (b.data as { bottleneckOrderCount: number }).bottleneckOrderCount >= 3)
      .map((b) => ({
        ...b,
        title: b.title.replace("Prep bottleneck", "Efficiency recommendation"),
      }));
  }
}
