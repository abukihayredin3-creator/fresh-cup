import { Injectable } from "@nestjs/common";
import { DriftSeverity, DriftType, type DriftAlert } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { mean } from "../../modules/intelligence/ml/stats.util";

export interface DriftCheckResult {
  driftType: DriftType;
  metricName: string;
  baselineValue: number;
  currentValue: number;
  psi: number;
  severity: DriftSeverity;
  isSignificant: boolean;
}

/**
 * Population Stability Index (PSI) — the standard, dependency-free way to
 * compare two distributions bucket-by-bucket: PSI < 0.1 is considered
 * stable, 0.1-0.25 a moderate shift, > 0.25 a significant one. Used for
 * both feature drift (are today's feature values shaped like training
 * data's?) and prediction drift (are today's scores shaped like the
 * historical score distribution?).
 */
function populationStabilityIndex(baseline: number[], current: number[], bins = 10): number {
  if (baseline.length === 0 || current.length === 0) return 0;
  const min = Math.min(...baseline, ...current);
  const max = Math.max(...baseline, ...current);
  if (min === max) return 0;

  const edges = Array.from({ length: bins + 1 }, (_, i) => min + (i / bins) * (max - min));
  const baselineCounts = histogram(baseline, edges);
  const currentCounts = histogram(current, edges);
  const EPSILON = 1e-6;

  let psi = 0;
  for (let i = 0; i < bins; i++) {
    const baselinePct = Math.max(baselineCounts[i]! / baseline.length, EPSILON);
    const currentPct = Math.max(currentCounts[i]! / current.length, EPSILON);
    psi += (currentPct - baselinePct) * Math.log(currentPct / baselinePct);
  }
  return psi;
}

function histogram(values: number[], edges: number[]): number[] {
  const bins = edges.length - 1;
  const counts = new Array<number>(bins).fill(0);
  for (const value of values) {
    let index = edges.findIndex((edge, i) => i < bins && value >= edge && value < edges[i + 1]!);
    if (index === -1) index = value >= edges[bins]! ? bins - 1 : 0;
    counts[index]! += 1;
  }
  return counts;
}

function severityFor(psi: number): DriftSeverity {
  if (psi > 0.25) return DriftSeverity.HIGH;
  if (psi > 0.1) return DriftSeverity.MEDIUM;
  return DriftSeverity.LOW;
}

@Injectable()
export class DriftDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkAndMaybeAlert(
    modelKey: string,
    driftType: DriftType,
    metricName: string,
    baseline: number[],
    current: number[],
    detail: string,
  ): Promise<DriftCheckResult> {
    const psi = populationStabilityIndex(baseline, current);
    const severity = severityFor(psi);
    const isSignificant = severity !== DriftSeverity.LOW;

    if (isSignificant) {
      await this.prisma.driftAlert.create({
        data: {
          modelKey,
          driftType,
          severity,
          metricName,
          baselineValue: mean(baseline),
          currentValue: mean(current),
          detail,
        },
      });
    }

    return {
      driftType,
      metricName,
      baselineValue: mean(baseline),
      currentValue: mean(current),
      psi: Math.round(psi * 1000) / 1000,
      severity,
      isSignificant,
    };
  }

  detectFeatureDrift(
    modelKey: string,
    featureName: string,
    baselineValues: number[],
    currentValues: number[],
  ): Promise<DriftCheckResult> {
    return this.checkAndMaybeAlert(
      modelKey,
      DriftType.FEATURE_DRIFT,
      featureName,
      baselineValues,
      currentValues,
      `Feature "${featureName}" distribution shifted (PSI-based comparison of ${baselineValues.length} baseline vs ${currentValues.length} current values)`,
    );
  }

  detectPredictionDrift(
    modelKey: string,
    baselinePredictions: number[],
    currentPredictions: number[],
  ): Promise<DriftCheckResult> {
    return this.checkAndMaybeAlert(
      modelKey,
      DriftType.PREDICTION_DRIFT,
      "prediction_score",
      baselinePredictions,
      currentPredictions,
      "The model's predicted-score distribution shifted vs its historical baseline",
    );
  }

  /** Data (volume) drift: a sudden change in how much data is flowing through the model, independent of its content. */
  async detectDataDrift(
    modelKey: string,
    baselineVolume: number,
    currentVolume: number,
  ): Promise<DriftCheckResult> {
    const relativeChange =
      baselineVolume === 0 ? 0 : Math.abs(currentVolume - baselineVolume) / baselineVolume;
    const severity: DriftSeverity =
      relativeChange > 0.5
        ? DriftSeverity.HIGH
        : relativeChange > 0.25
          ? DriftSeverity.MEDIUM
          : DriftSeverity.LOW;
    const isSignificant = severity !== DriftSeverity.LOW;

    if (isSignificant) {
      await this.prisma.driftAlert.create({
        data: {
          modelKey,
          driftType: DriftType.DATA_DRIFT,
          severity,
          metricName: "sample_volume",
          baselineValue: baselineVolume,
          currentValue: currentVolume,
          detail: `Data volume changed by ${Math.round(relativeChange * 100)}% vs baseline`,
        },
      });
    }

    return {
      driftType: DriftType.DATA_DRIFT,
      metricName: "sample_volume",
      baselineValue: baselineVolume,
      currentValue: currentVolume,
      psi: Math.round(relativeChange * 1000) / 1000,
      severity,
      isSignificant,
    };
  }

  /** Concept drift: the relationship between features and outcome changed — surfaced as a drop in model accuracy/AUC. */
  async detectConceptDrift(
    modelKey: string,
    baselineAccuracy: number,
    currentAccuracy: number,
  ): Promise<DriftCheckResult> {
    const drop = baselineAccuracy - currentAccuracy;
    const severity: DriftSeverity =
      drop > 0.2 ? DriftSeverity.HIGH : drop > 0.1 ? DriftSeverity.MEDIUM : DriftSeverity.LOW;
    const isSignificant = severity !== DriftSeverity.LOW;

    if (isSignificant) {
      await this.prisma.driftAlert.create({
        data: {
          modelKey,
          driftType: DriftType.CONCEPT_DRIFT,
          severity,
          metricName: "accuracy",
          baselineValue: baselineAccuracy,
          currentValue: currentAccuracy,
          detail: `Model accuracy dropped by ${Math.round(drop * 100)} percentage points vs baseline`,
        },
      });
    }

    return {
      driftType: DriftType.CONCEPT_DRIFT,
      metricName: "accuracy",
      baselineValue: baselineAccuracy,
      currentValue: currentAccuracy,
      psi: Math.round(drop * 1000) / 1000,
      severity,
      isSignificant,
    };
  }

  listAlerts(modelKey?: string, unresolvedOnly = false): Promise<DriftAlert[]> {
    return this.prisma.driftAlert.findMany({
      where: { modelKey, resolvedAt: unresolvedOnly ? null : undefined },
      orderBy: { detectedAt: "desc" },
      take: 100,
    });
  }

  resolveAlert(id: string): Promise<DriftAlert> {
    return this.prisma.driftAlert.update({ where: { id }, data: { resolvedAt: new Date() } });
  }
}
