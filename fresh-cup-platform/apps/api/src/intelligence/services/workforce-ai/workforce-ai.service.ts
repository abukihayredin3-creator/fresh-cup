import { Injectable } from "@nestjs/common";
import { OrderStatus, ShiftStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { mean, stdDev } from "../../../modules/intelligence/ml/stats.util";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { ExplanationService } from "../explanation.service";

const WINDOW_DAYS = 14;
const COUNTED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];
const LATE_CLOCK_IN_MINUTES = 15;

/**
 * Net-new — Phase 6 had no workforce intelligence. Built directly from
 * Shift/Attendance/PerformanceNote (already recorded by Phase 5's
 * employees module), no new columns needed. `laborCostOptimization`
 * deliberately reports coverage efficiency (orders per scheduled labor
 * hour) rather than a Birr cost figure — the schema has no wage/hourly
 * rate column, and Core Principle 1 ("never fabricate data") rules out
 * inventing one.
 */
@Injectable()
export class WorkforceAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly explanation: ExplanationService,
  ) {}

  private async ordersByHour(branchId: string | undefined, since: Date): Promise<number[]> {
    const orders = await this.prisma.order.findMany({
      where: { branchId, status: { in: COUNTED_ORDER_STATUSES }, placedAt: { gte: since } },
      select: { placedAt: true },
    });
    const byHour = new Array<number>(24).fill(0);
    for (const order of orders) {
      byHour[order.placedAt.getHours()]! += 1;
    }
    return byHour;
  }

  private async scheduledHoursByHour(branchId: string | undefined, since: Date): Promise<number[]> {
    const shifts = await this.prisma.shift.findMany({
      where: { branchId, startsAt: { gte: since } },
      select: { startsAt: true, endsAt: true },
    });
    const byHour = new Array<number>(24).fill(0);
    for (const shift of shifts) {
      const startHour = shift.startsAt.getHours();
      const endHour = shift.endsAt.getHours() || 24;
      for (let h = startHour; h < endHour; h++) {
        byHour[h % 24]! += 1;
      }
    }
    return byHour;
  }

  async schedulingInsights(branchId?: string): Promise<AiInsightDto[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [orders, scheduledHours] = await Promise.all([
      this.ordersByHour(branchId, since),
      this.scheduledHoursByHour(branchId, since),
    ]);

    const ratios = orders.map((orderCount, hour) => ({
      hour,
      ratio: orderCount / Math.max(scheduledHours[hour] ?? 0, 0.1),
      orderCount,
      scheduledHours: scheduledHours[hour] ?? 0,
    }));
    const active = ratios.filter((r) => r.orderCount > 0 || r.scheduledHours > 0);
    if (active.length < 2) return [];

    const avg = mean(active.map((r) => r.ratio));
    const sd = stdDev(active.map((r) => r.ratio));
    if (sd === 0) return [];

    const flagged = active.filter((r) => Math.abs(r.ratio - avg) > sd);
    return Promise.all(
      flagged.map(async (r) => {
        const status = r.ratio > avg ? "understaffed" : "overstaffed";
        const dataPoints = {
          hour: r.hour,
          ordersPerScheduledHour: Math.round(r.ratio * 10) / 10,
          status,
        };
        return {
          title: `Scheduling insight: ${r.hour}:00 (${status})`,
          explanation: await this.explanation.explain(
            `Scheduling insight for ${r.hour}:00`,
            dataPoints,
          ),
          confidence: confidenceScore(active.map((a) => a.ratio)),
          data: dataPoints,
        };
      }),
    );
  }

  async attendanceAnomalies(branchId?: string): Promise<AiInsightDto[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const shifts = await this.prisma.shift.findMany({
      where: {
        branchId,
        startsAt: { gte: since, lte: new Date() },
        status: { not: ShiftStatus.CANCELLED },
      },
      include: { user: { select: { fullName: true } } },
    });
    const attendances = await this.prisma.attendance.findMany({
      where: { branchId, clockInAt: { gte: since } },
    });

    const insights: AiInsightDto[] = [];
    for (const shift of shifts) {
      const sameDayAttendance = attendances.find(
        (a) => a.userId === shift.userId && this.isSameDay(a.clockInAt, shift.startsAt),
      );

      if (!sameDayAttendance) {
        const dataPoints = {
          userFullName: shift.user.fullName,
          shiftStart: shift.startsAt.toISOString(),
        };
        insights.push({
          title: `No-show: ${shift.user.fullName}`,
          explanation: await this.explanation.explain(
            `No-show for ${shift.user.fullName}`,
            dataPoints,
          ),
          confidence: 0.6,
          data: dataPoints,
        });
        continue;
      }

      const lateMinutes =
        (sameDayAttendance.clockInAt.getTime() - shift.startsAt.getTime()) / (1000 * 60);
      if (lateMinutes > LATE_CLOCK_IN_MINUTES) {
        const dataPoints = {
          userFullName: shift.user.fullName,
          lateMinutes: Math.round(lateMinutes),
        };
        insights.push({
          title: `Late clock-in: ${shift.user.fullName}`,
          explanation: await this.explanation.explain(
            `Late clock-in for ${shift.user.fullName}`,
            dataPoints,
          ),
          confidence: 0.6,
          data: dataPoints,
        });
      }
    }
    return insights;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  async performanceTrends(branchId?: string): Promise<AiInsightDto[]> {
    const now = Date.now();
    const recentSince = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const priorSince = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const notes = await this.prisma.performanceNote.findMany({
      where: {
        createdAt: { gte: priorSince },
        rating: { not: null },
        user: branchId ? { branchId } : undefined,
      },
      select: { userId: true, rating: true, createdAt: true, user: { select: { fullName: true } } },
    });

    const byUser = new Map<string, { fullName: string; recent: number[]; prior: number[] }>();
    for (const note of notes) {
      const bucket = byUser.get(note.userId) ?? {
        fullName: note.user.fullName,
        recent: [],
        prior: [],
      };
      if (note.createdAt >= recentSince) bucket.recent.push(note.rating!);
      else bucket.prior.push(note.rating!);
      byUser.set(note.userId, bucket);
    }

    const results: AiInsightDto[] = [];
    for (const [, bucket] of byUser) {
      if (bucket.recent.length === 0 || bucket.prior.length === 0) continue;
      const recentAvg = mean(bucket.recent);
      const priorAvg = mean(bucket.prior);
      const trend =
        recentAvg > priorAvg ? "improving" : recentAvg < priorAvg ? "declining" : "stable";
      const dataPoints = {
        recentAvgRating: Math.round(recentAvg * 10) / 10,
        priorAvgRating: Math.round(priorAvg * 10) / 10,
        trend,
      };
      results.push({
        title: `Performance trend: ${bucket.fullName} (${trend})`,
        explanation: await this.explanation.explain(
          `Performance trend for ${bucket.fullName}`,
          dataPoints,
        ),
        confidence: confidenceScore([...bucket.recent, ...bucket.prior]),
        data: dataPoints,
      });
    }
    return results;
  }

  async laborCostOptimization(branchId?: string): Promise<AiInsightDto[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [orders, scheduledHours] = await Promise.all([
      this.ordersByHour(branchId, since),
      this.scheduledHoursByHour(branchId, since),
    ]);
    const totalOrders = orders.reduce((sum, v) => sum + v, 0);
    const totalScheduledHours = scheduledHours.reduce((sum, v) => sum + v, 0);
    if (totalScheduledHours === 0) return [];

    const ordersPerLaborHour = Math.round((totalOrders / totalScheduledHours) * 10) / 10;
    const dataPoints = { totalOrders, totalScheduledHours, ordersPerLaborHour };
    return [
      {
        title: "Labor coverage efficiency",
        explanation: await this.explanation.explain("Labor coverage efficiency", dataPoints),
        confidence: confidenceScore(orders),
        data: dataPoints,
      },
    ];
  }
}
