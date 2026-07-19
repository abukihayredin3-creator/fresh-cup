/**
 * Standard model-evaluation metrics, hand-rolled and dependency-free
 * (same "no heavy library for a simple need" judgment call as Phase 6's
 * ml/stats.util.ts) — used by EvaluationService to score a model's
 * historical predictions against what actually happened, and by
 * RetrainingService to decide whether performance has degraded enough to
 * trigger a retrain.
 */
export interface ConfusionMatrix {
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
}

export function confusionMatrix(predicted: boolean[], actual: boolean[]): ConfusionMatrix {
  const matrix: ConfusionMatrix = {
    truePositive: 0,
    falsePositive: 0,
    trueNegative: 0,
    falseNegative: 0,
  };
  const length = Math.min(predicted.length, actual.length);
  for (let i = 0; i < length; i++) {
    if (predicted[i] && actual[i]) matrix.truePositive++;
    else if (predicted[i] && !actual[i]) matrix.falsePositive++;
    else if (!predicted[i] && actual[i]) matrix.falseNegative++;
    else matrix.trueNegative++;
  }
  return matrix;
}

export function precision(matrix: ConfusionMatrix): number {
  const denominator = matrix.truePositive + matrix.falsePositive;
  return denominator === 0 ? 0 : matrix.truePositive / denominator;
}

export function recall(matrix: ConfusionMatrix): number {
  const denominator = matrix.truePositive + matrix.falseNegative;
  return denominator === 0 ? 0 : matrix.truePositive / denominator;
}

export function f1Score(matrix: ConfusionMatrix): number {
  const p = precision(matrix);
  const r = recall(matrix);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

/**
 * ROC AUC via the Mann-Whitney U statistic: the probability a random
 * positive scores higher than a random negative (ties count as half) —
 * exactly equivalent to the area under the ROC curve, without needing to
 * sweep thresholds. O(n*m) in positive/negative counts, fine at
 * evaluation-window scale.
 */
export function rocAuc(scores: number[], actual: boolean[]): number {
  const positives: number[] = [];
  const negatives: number[] = [];
  const length = Math.min(scores.length, actual.length);
  for (let i = 0; i < length; i++) {
    (actual[i] ? positives : negatives).push(scores[i]!);
  }
  if (positives.length === 0 || negatives.length === 0) return 0.5;

  let wins = 0;
  for (const p of positives) {
    for (const n of negatives) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

export function mape(predicted: number[], actual: number[]): number {
  const length = Math.min(predicted.length, actual.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < length; i++) {
    if (actual[i] === 0) continue; // undefined for zero actuals — excluded rather than dividing by zero
    sum += Math.abs((actual[i]! - predicted[i]!) / actual[i]!);
    count++;
  }
  return count === 0 ? 0 : (sum / count) * 100;
}

export function rmse(predicted: number[], actual: number[]): number {
  const length = Math.min(predicted.length, actual.length);
  if (length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < length; i++) {
    sumSquares += (predicted[i]! - actual[i]!) ** 2;
  }
  return Math.sqrt(sumSquares / length);
}

export function mae(predicted: number[], actual: number[]): number {
  const length = Math.min(predicted.length, actual.length);
  if (length === 0) return 0;
  let sumAbs = 0;
  for (let i = 0; i < length; i++) {
    sumAbs += Math.abs(predicted[i]! - actual[i]!);
  }
  return sumAbs / length;
}

export interface CalibrationBin {
  binStart: number;
  binEnd: number;
  avgPredicted: number;
  avgActual: number;
  count: number;
}

/** A reliability diagram: buckets predicted probabilities and compares each bucket's average predicted value to its average actual outcome rate. */
export function calibrationCurve(
  predictedProbabilities: number[],
  actualOutcomes: boolean[],
  bins = 10,
): CalibrationBin[] {
  const length = Math.min(predictedProbabilities.length, actualOutcomes.length);
  const buckets: { predicted: number[]; actual: boolean[] }[] = Array.from(
    { length: bins },
    () => ({
      predicted: [],
      actual: [],
    }),
  );

  for (let i = 0; i < length; i++) {
    const p = Math.min(0.999999, Math.max(0, predictedProbabilities[i]!));
    const binIndex = Math.floor(p * bins);
    buckets[binIndex]!.predicted.push(predictedProbabilities[i]!);
    buckets[binIndex]!.actual.push(actualOutcomes[i]!);
  }

  return buckets
    .map((bucket, i) => ({
      binStart: i / bins,
      binEnd: (i + 1) / bins,
      avgPredicted: bucket.predicted.length
        ? bucket.predicted.reduce((a, b) => a + b, 0) / bucket.predicted.length
        : 0,
      avgActual: bucket.actual.length
        ? bucket.actual.filter(Boolean).length / bucket.actual.length
        : 0,
      count: bucket.predicted.length,
    }))
    .filter((bin) => bin.count > 0);
}
