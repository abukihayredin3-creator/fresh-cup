import { Injectable } from "@nestjs/common";
import type { PredictiveModelRun } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ForecastingService } from "../../modules/intelligence/forecasting/forecasting.service";
import { DriftDetectionService } from "../drift/drift-detection.service";
import { ModelRegistryV2Service } from "../registry/model-registry-v2.service";
import { hashDataset } from "./dataset-hash.util";

export type RetrainTrigger = "drift" | "performance" | "new_data" | "manual";

const NEW_DATA_ORDER_THRESHOLD = 50;
const TRAINING_WINDOW_DAYS = 90;

/** Every model this platform can retrain — customer-prediction models retrain their dataset snapshot; sales-* models also regenerate Phase 6's forecast snapshots. */
export const TRAINABLE_MODEL_KEYS = [
  "customer-lifetime-value",
  "repeat-purchase-probability",
  "customer-churn",
  "customer-upsell",
  "customer-cross-sell",
  "customer-coupon-response",
  "customer-referral-probability",
  "customer-satisfaction",
  "sales-hourly",
  "sales-daily",
  "sales-weekly",
  "sales-monthly",
  "sales-revenue",
  "sales-transactions",
  "sales-average-ticket",
  "sales-best-sellers",
  "sales-category-trends",
] as const;

export interface TriggerCheckResult {
  modelKey: string;
  shouldRetrain: boolean;
  reasons: RetrainTrigger[];
}

/**
 * Automatic retraining: `checkTriggers` decides IF a model needs
 * retraining (unresolved drift, enough new orders since last training, or
 * never trained); `retrain` actually does it — for `sales-*` models that
 * means regenerating Phase 6's forecast snapshots
 * (`ForecastingService.regenerateAll()`, reused, not reimplemented); every
 * model, including the hand-weighted customer-prediction ones, gets a new
 * versioned registry row recording the dataset it was last validated
 * against (hash/version/sample count) — see `ModelRegistryV2Service`.
 */
@Injectable()
export class RetrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModelRegistryV2Service,
    private readonly drift: DriftDetectionService,
    private readonly forecastingService: ForecastingService,
  ) {}

  async checkTriggers(modelKey: string): Promise<TriggerCheckResult> {
    const reasons: RetrainTrigger[] = [];

    const alerts = await this.drift.listAlerts(modelKey, true);
    if (alerts.length > 0) reasons.push("drift");

    const runs = await this.registry.listRuns(modelKey);
    const last = runs[0];
    if (!last) {
      reasons.push("new_data");
    } else {
      const newOrders = await this.prisma.order.count({
        where: { placedAt: { gt: last.trainedAt } },
      });
      if (newOrders >= NEW_DATA_ORDER_THRESHOLD) reasons.push("new_data");
    }

    return { modelKey, shouldRetrain: reasons.length > 0, reasons };
  }

  async retrain(modelKey: string, trigger: RetrainTrigger): Promise<PredictiveModelRun> {
    if (modelKey.startsWith("sales-")) {
      await this.forecastingService.regenerateAll();
    }

    const since = new Date(Date.now() - TRAINING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [sampleCount, range] = await Promise.all([
      this.prisma.order.count({ where: { placedAt: { gte: since } } }),
      this.prisma.order.aggregate({
        _min: { placedAt: true },
        _max: { placedAt: true },
        where: { placedAt: { gte: since } },
      }),
    ]);
    const datasetVersion = new Date().toISOString().slice(0, 10);
    const datasetHash = hashDataset(
      `${modelKey}:${sampleCount}:${range._min.placedAt?.toISOString() ?? ""}:${range._max.placedAt?.toISOString() ?? ""}`,
    );

    return this.registry.recordRun({
      modelKey,
      datasetHash,
      datasetVersion,
      sampleCount,
      featureSchema: { trainingWindowDays: TRAINING_WINDOW_DAYS },
      notes: `Retrained (trigger: ${trigger})`,
    });
  }

  async checkAndRetrainAll(
    modelKeys: readonly string[] = TRAINABLE_MODEL_KEYS,
  ): Promise<TriggerCheckResult[]> {
    const results: TriggerCheckResult[] = [];
    for (const modelKey of modelKeys) {
      const check = await this.checkTriggers(modelKey);
      if (check.shouldRetrain) {
        await this.retrain(modelKey, check.reasons[0]!);
      }
      results.push(check);
    }
    return results;
  }
}
