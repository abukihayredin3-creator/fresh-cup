import { Injectable } from "@nestjs/common";
import { calibrationCurve, type CalibrationBin } from "../evaluation/metrics.util";

const MIN_CONFIDENCE = 0.05;
const MAX_CONFIDENCE = 0.95;
const DEFAULT_REJECTION_THRESHOLD = 0.4;

export interface CalibrationModel {
  modelKey: string;
  bins: CalibrationBin[];
}

/**
 * Confidence calibration in the same sense a reliability diagram / Platt
 * scaling gives you: a raw model score of "0.8" is only meaningful if,
 * historically, things scored around 0.8 actually happened about 80% of
 * the time. `buildCalibrationModel` learns that mapping from
 * (predicted, actual) history via `evaluation/metrics.util.ts`'s binned
 * calibration curve; `calibrate` replaces a raw score with its bin's
 * empirical actual-rate. Falls back to a clamp-only normalization when no
 * history exists yet — every score still has SOME output, just an
 * uncalibrated one until enough outcomes have been observed.
 */
@Injectable()
export class ConfidenceCalibratorService {
  buildCalibrationModel(
    modelKey: string,
    predicted: number[],
    actual: boolean[],
  ): CalibrationModel {
    return { modelKey, bins: calibrationCurve(predicted, actual) };
  }

  /** Clamps a raw confidence into a sane range — no history needed. */
  normalize(rawConfidence: number): number {
    if (Number.isNaN(rawConfidence)) return MIN_CONFIDENCE;
    return Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, rawConfidence));
  }

  /** Replaces a raw confidence with its calibration bin's empirical actual-rate, when a model is available. */
  calibrate(rawConfidence: number, model?: CalibrationModel | null): number {
    const clamped = this.normalize(rawConfidence);
    if (!model || model.bins.length === 0) return clamped;

    const bin =
      model.bins.find((b) => clamped >= b.binStart && clamped < b.binEnd) ??
      model.bins[model.bins.length - 1]!;
    return this.normalize(bin.avgActual);
  }

  /** Filters out recommendations below a confidence threshold — the platform should stay silent rather than push a low-confidence guess. */
  rejectLowConfidence<T extends { confidence: number }>(
    items: T[],
    threshold = DEFAULT_REJECTION_THRESHOLD,
  ): T[] {
    return items.filter((item) => item.confidence >= threshold);
  }
}
