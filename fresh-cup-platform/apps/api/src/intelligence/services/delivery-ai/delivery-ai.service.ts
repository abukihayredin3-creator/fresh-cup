import { Injectable } from "@nestjs/common";
import { DeliveryStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { mean } from "../../../modules/intelligence/ml/stats.util";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { ExplanationService } from "../explanation.service";

const WINDOW_DAYS = 30;
/** Elapsed time beyond this multiple of the fleet's expected duration counts as delayed. */
const DELAY_OVERRUN_RATIO = 1.3;

function toBirr(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

interface CompletedDelivery {
  id: string;
  driverId: string | null;
  zoneId: string | null;
  distanceKm: number | null;
  fee: number;
  pickedUpAt: Date | null;
  deliveredAt: Date;
}

/**
 * Net-new — Phase 6 had no delivery-operations intelligence. Built
 * directly from Delivery.distanceKm/fee/pickedUpAt/deliveredAt (already
 * recorded by the Phase 3 delivery workflow), no new columns needed.
 */
@Injectable()
export class DeliveryAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly explanation: ExplanationService,
  ) {}

  private async completedDeliveries(branchId?: string): Promise<CompletedDelivery[]> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const deliveries = await this.prisma.delivery.findMany({
      where: {
        branchId,
        status: DeliveryStatus.DELIVERED,
        pickedUpAt: { not: null },
        deliveredAt: { not: null, gte: since },
        distanceKm: { not: null },
      },
      select: {
        id: true,
        driverId: true,
        zoneId: true,
        distanceKm: true,
        fee: true,
        pickedUpAt: true,
        deliveredAt: true,
      },
    });
    return deliveries.map((d) => ({
      ...d,
      distanceKm: d.distanceKm ? Number(d.distanceKm) : null,
    })) as CompletedDelivery[];
  }

  /** Average km/h across recent completed deliveries — the basis for every prediction below. */
  private fleetAverageSpeedKmH(deliveries: CompletedDelivery[]): number {
    const speeds = deliveries
      .filter((d) => d.distanceKm && d.distanceKm > 0 && d.pickedUpAt)
      .map((d) => {
        const hours = (d.deliveredAt.getTime() - d.pickedUpAt!.getTime()) / (1000 * 60 * 60);
        return hours > 0 ? d.distanceKm! / hours : 0;
      })
      .filter((speed) => speed > 0);
    return speeds.length ? mean(speeds) : 20; // 20 km/h — a reasonable urban default with no history yet
  }

  async etaPrediction(distanceKm: number, branchId?: string): Promise<AiInsightDto> {
    const deliveries = await this.completedDeliveries(branchId);
    const avgSpeedKmH = this.fleetAverageSpeedKmH(deliveries);
    const predictedMinutes = Math.round((distanceKm / avgSpeedKmH) * 60);
    const dataPoints = {
      distanceKm,
      predictedMinutes,
      avgSpeedKmH: Math.round(avgSpeedKmH * 10) / 10,
    };
    return {
      title: "Delivery ETA prediction",
      explanation: await this.explanation.explain("Delivery ETA prediction", dataPoints),
      confidence: confidenceScore(deliveries.map((d) => d.distanceKm ?? 0)),
      data: dataPoints,
    };
  }

  async delayDetection(branchId?: string): Promise<AiInsightDto[]> {
    const [history, inFlight] = await Promise.all([
      this.completedDeliveries(branchId),
      this.prisma.delivery.findMany({
        where: {
          branchId,
          status: { in: [DeliveryStatus.PICKED_UP, DeliveryStatus.EN_ROUTE] },
          pickedUpAt: { not: null },
          distanceKm: { not: null },
        },
        select: { id: true, distanceKm: true, pickedUpAt: true },
      }),
    ]);
    const avgSpeedKmH = this.fleetAverageSpeedKmH(history);

    const delayed = inFlight.filter((d) => {
      const distanceKm = Number(d.distanceKm);
      const expectedMinutes = (distanceKm / avgSpeedKmH) * 60;
      const elapsedMinutes = (Date.now() - d.pickedUpAt!.getTime()) / (1000 * 60);
      return elapsedMinutes > expectedMinutes * DELAY_OVERRUN_RATIO;
    });

    return Promise.all(
      delayed.map(async (d) => {
        const elapsedMinutes = Math.round((Date.now() - d.pickedUpAt!.getTime()) / (1000 * 60));
        const dataPoints = { deliveryId: d.id, elapsedMinutes };
        return {
          title: `Delivery delay: order ${d.id.slice(0, 8)}`,
          explanation: await this.explanation.explain("Delivery delay", dataPoints),
          confidence: confidenceScore(history.map((h) => h.distanceKm ?? 0)),
          data: dataPoints,
        };
      }),
    );
  }

  async zoneOptimization(branchId?: string): Promise<AiInsightDto[]> {
    const deliveries = await this.completedDeliveries(branchId);
    const byZone = new Map<string, CompletedDelivery[]>();
    for (const delivery of deliveries) {
      if (!delivery.zoneId) continue;
      const bucket = byZone.get(delivery.zoneId) ?? [];
      bucket.push(delivery);
      byZone.set(delivery.zoneId, bucket);
    }

    const zoneIds = Array.from(byZone.keys());
    const zones = await this.prisma.deliveryZone.findMany({ where: { id: { in: zoneIds } } });
    const nameById = new Map(zones.map((z) => [z.id, z.name]));

    return Promise.all(
      Array.from(byZone.entries()).map(async ([zoneId, zoneDeliveries]) => {
        const avgFeeEtb = toBirr(mean(zoneDeliveries.map((d) => d.fee)));
        const avgDistanceKm = mean(zoneDeliveries.map((d) => d.distanceKm ?? 0));
        const feePerKmEtb =
          avgDistanceKm > 0 ? Math.round((avgFeeEtb / avgDistanceKm) * 100) / 100 : null;
        const dataPoints = {
          deliveryCount: zoneDeliveries.length,
          avgFeeEtb,
          avgDistanceKm: Math.round(avgDistanceKm * 10) / 10,
          feePerKmEtb,
        };
        return {
          title: `Zone: ${nameById.get(zoneId) ?? "Unknown zone"}`,
          explanation: await this.explanation.explain(
            `Zone optimization for ${nameById.get(zoneId) ?? zoneId}`,
            dataPoints,
          ),
          confidence: confidenceScore(zoneDeliveries.map((d) => d.fee)),
          data: dataPoints,
        };
      }),
    );
  }

  async driverUtilization(branchId?: string): Promise<AiInsightDto[]> {
    const deliveries = await this.completedDeliveries(branchId);
    const byDriver = new Map<string, CompletedDelivery[]>();
    for (const delivery of deliveries) {
      if (!delivery.driverId) continue;
      const bucket = byDriver.get(delivery.driverId) ?? [];
      bucket.push(delivery);
      byDriver.set(delivery.driverId, bucket);
    }

    const driverIds = Array.from(byDriver.keys());
    const drivers = await this.prisma.user.findMany({ where: { id: { in: driverIds } } });
    const nameById = new Map(drivers.map((d) => [d.id, d.fullName]));
    const counts = Array.from(byDriver.values()).map((d) => d.length);

    return Promise.all(
      Array.from(byDriver.entries()).map(async ([driverId, driverDeliveries]) => {
        const avgDurationMinutes = mean(
          driverDeliveries
            .filter((d) => d.pickedUpAt)
            .map((d) => (d.deliveredAt.getTime() - d.pickedUpAt!.getTime()) / (1000 * 60)),
        );
        const dataPoints = {
          deliveriesCompleted: driverDeliveries.length,
          avgDurationMinutes: Math.round(avgDurationMinutes),
        };
        return {
          title: `Driver utilization: ${nameById.get(driverId) ?? "Unknown driver"}`,
          explanation: await this.explanation.explain(
            `Driver utilization for ${nameById.get(driverId) ?? driverId}`,
            dataPoints,
          ),
          confidence: confidenceScore(counts),
          data: dataPoints,
        };
      }),
    );
  }
}
