import { Injectable } from "@nestjs/common";
import {
  AiPriority,
  InventoryTransactionReason,
  type ExecutiveAlert,
  type Prisma,
} from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../../ai-brain/interfaces/ai-brain.interfaces";
import { ReasoningEngineService } from "../../ai-brain/services/reasoning-engine.service";
import type { AlertCandidate } from "../interfaces/ai-copilot.interfaces";
import { AiCopilotScopeService } from "./ai-copilot-scope.service";

const WINDOW_DAYS = 7;
/** A revenue/order swing smaller than this is normal noise, not an anomaly — matches ReasoningEngineService. */
const REVENUE_DROP_THRESHOLD_PCT = 10;
const ORDERS_LOW_THRESHOLD_PCT = 15;
/** Waste cost has to at least 1.5x week-over-week, and be non-trivial, to count as "unusually high". */
const WASTE_SPIKE_MULTIPLIER = 1.5;
const MISMATCH_ADJUSTMENT_COUNT_THRESHOLD = 3;
const LOW_RATING_THRESHOLD = 2;
const COMPLAINT_SPIKE_MULTIPLIER = 1.5;
const MIN_COMPLAINTS_FOR_SPIKE = 3;

function severityForMagnitude(magnitudePct: number): AiPriority {
  if (magnitudePct >= 40) return AiPriority.CRITICAL;
  if (magnitudePct >= 25) return AiPriority.HIGH;
  if (magnitudePct >= 10) return AiPriority.MEDIUM;
  return AiPriority.LOW;
}

function windowBounds(): { currentStart: Date; previousStart: Date } {
  const now = new Date();
  const currentStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - 2 * WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { currentStart, previousStart };
}

/**
 * Scans for unusual, evidenced business events — every anomaly is
 * computed from real Prisma data over the trailing 7-day window versus
 * the 7 days before it, never fabricated. Revenue/order anomalies reuse
 * ReasoningEngineService's own sales trend signal (Phase 9 Task 1)
 * instead of recomputing it; waste, inventory-mismatch, and
 * customer-complaint anomalies are genuinely new signals nothing else in
 * the codebase computes. Persists each detected anomaly as an
 * ExecutiveAlert.
 */
@Injectable()
export class AnomalyDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AiCopilotScopeService,
    private readonly reasoning: ReasoningEngineService,
  ) {}

  async detect(
    actor: RequestUser,
    organizationId: string,
    branchId?: string,
  ): Promise<ExecutiveAlert[]> {
    const branchIds = await this.scope.resolveBranches(actor, organizationId, branchId);
    const perBranch = await Promise.all(
      branchIds.map((id) => this.detectForBranch(organizationId, id)),
    );
    const candidates = perBranch.flat();
    if (candidates.length === 0) {
      return [];
    }

    return Promise.all(
      candidates.map((candidate) =>
        this.prisma.executiveAlert.create({
          data: {
            organizationId,
            branchId: branchId ?? undefined,
            type: candidate.type,
            severity: candidate.severity,
            confidence: candidate.confidence,
            evidence: candidate.evidence as unknown as Prisma.InputJsonValue,
            recommendedAction: candidate.recommendedAction,
          },
        }),
      ),
    );
  }

  private async detectForBranch(
    organizationId: string,
    branchId: string,
  ): Promise<AlertCandidate[]> {
    const [salesInsight, wasteAnomaly, mismatchAnomaly, complaintAnomaly] = await Promise.all([
      this.reasoning.analyze(organizationId, "sales", branchId),
      this.wasteAnomaly(branchId),
      this.inventoryMismatchAnomaly(branchId),
      this.complaintSpikeAnomaly(branchId),
    ]);

    const candidates: AlertCandidate[] = [
      ...this.salesAnomalies(salesInsight.content as unknown as ReasoningResult),
    ];
    if (wasteAnomaly) candidates.push(wasteAnomaly);
    if (mismatchAnomaly) candidates.push(mismatchAnomaly);
    if (complaintAnomaly) candidates.push(complaintAnomaly);
    return candidates;
  }

  private salesAnomalies(content: ReasoningResult): AlertCandidate[] {
    if (content.signals.kind !== "sales") {
      return [];
    }
    const { trend } = content.signals;
    const candidates: AlertCandidate[] = [];

    if (trend.revenueChangePct <= -REVENUE_DROP_THRESHOLD_PCT) {
      candidates.push({
        type: "REVENUE_DROP",
        severity: severityForMagnitude(Math.abs(trend.revenueChangePct)),
        confidence: content.confidence,
        evidence: [
          {
            source: "Reasoning Engine (sales)",
            detail: `Revenue ${trend.currentRevenue} vs previous ${trend.previousRevenue} (${trend.revenueChangePct.toFixed(1)}%)`,
          },
        ],
        recommendedAction:
          "Investigate the cause of the revenue decline and consider a promotional push",
      });
    }

    if (trend.orderChangePct <= -ORDERS_LOW_THRESHOLD_PCT) {
      candidates.push({
        type: "ORDERS_LOW",
        severity: severityForMagnitude(Math.abs(trend.orderChangePct)),
        confidence: content.confidence,
        evidence: [
          {
            source: "Reasoning Engine (sales)",
            detail: `Orders ${trend.currentOrderCount} vs previous ${trend.previousOrderCount} (${trend.orderChangePct.toFixed(1)}%)`,
          },
        ],
        recommendedAction: "Review marketing reach and menu visibility — order volume fell sharply",
      });
    }

    return candidates;
  }

  private async wasteAnomaly(branchId: string): Promise<AlertCandidate | null> {
    const { currentStart, previousStart } = windowBounds();
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        reason: InventoryTransactionReason.WASTE,
        createdAt: { gte: previousStart },
        inventoryItem: { branchId },
      },
      include: { inventoryItem: { select: { unitCost: true } } },
    });

    let currentCost = 0;
    let previousCost = 0;
    for (const tx of transactions) {
      const cost = Math.abs(Number(tx.delta)) * tx.inventoryItem.unitCost;
      if (tx.createdAt >= currentStart) {
        currentCost += cost;
      } else {
        previousCost += cost;
      }
    }

    if (currentCost < 1000 || currentCost < previousCost * WASTE_SPIKE_MULTIPLIER) {
      return null;
    }

    const changePct = previousCost > 0 ? ((currentCost - previousCost) / previousCost) * 100 : 100;
    return {
      type: "WASTE_HIGH",
      severity: severityForMagnitude(changePct),
      confidence: Math.min(0.9, 0.5 + transactions.length / 20),
      evidence: [
        {
          source: "InventoryTransaction (WASTE, last 7 days vs previous 7)",
          detail: `Waste cost ${Math.round(currentCost)} vs previous ${Math.round(previousCost)} (${changePct.toFixed(1)}%)`,
        },
      ],
      recommendedAction: "Review prep/portioning and shelf-life handling — waste cost rose sharply",
    };
  }

  private async inventoryMismatchAnomaly(branchId: string): Promise<AlertCandidate | null> {
    const { currentStart } = windowBounds();
    const adjustments = await this.prisma.inventoryTransaction.findMany({
      where: {
        reason: InventoryTransactionReason.MANUAL_ADJUSTMENT,
        createdAt: { gte: currentStart },
        inventoryItem: { branchId },
      },
      select: { delta: true, inventoryItemId: true },
    });

    if (adjustments.length < MISMATCH_ADJUSTMENT_COUNT_THRESHOLD) {
      return null;
    }

    const distinctItems = new Set(adjustments.map((a) => a.inventoryItemId)).size;
    return {
      type: "INVENTORY_MISMATCH",
      severity: adjustments.length >= 5 ? AiPriority.HIGH : AiPriority.MEDIUM,
      confidence: Math.min(0.9, 0.4 + adjustments.length / 10),
      evidence: [
        {
          source: "InventoryTransaction (MANUAL_ADJUSTMENT, last 7 days)",
          detail: `${adjustments.length} manual stock correction(s) across ${distinctItems} item(s)`,
        },
      ],
      recommendedAction:
        "Audit stock-counting procedure — frequent manual corrections suggest count drift",
    };
  }

  private async complaintSpikeAnomaly(branchId: string): Promise<AlertCandidate | null> {
    const { currentStart, previousStart } = windowBounds();
    const reviews = await this.prisma.productReview.findMany({
      where: {
        rating: { lte: LOW_RATING_THRESHOLD },
        createdAt: { gte: previousStart },
        menuItem: { branchId },
      },
      select: { createdAt: true },
    });

    const current = reviews.filter((r) => r.createdAt >= currentStart).length;
    const previous = reviews.length - current;

    const isSpike =
      current >= MIN_COMPLAINTS_FOR_SPIKE &&
      current >= Math.max(1, previous) * COMPLAINT_SPIKE_MULTIPLIER;
    if (!isSpike) {
      return null;
    }

    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 100;
    return {
      type: "COMPLAINT_SPIKE",
      severity: severityForMagnitude(changePct),
      confidence: Math.min(0.9, 0.4 + current / 10),
      evidence: [
        {
          source: "ProductReview (rating <= 2, last 7 days vs previous 7)",
          detail: `${current} low-rating review(s) vs previous ${previous}`,
        },
      ],
      recommendedAction:
        "Review recent low-rated orders for a common cause (quality, wait time, accuracy)",
    };
  }
}
