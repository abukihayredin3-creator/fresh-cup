/**
 * Hand-rolled statistical primitives shared across the Phase 6 intelligence
 * services (forecasting, customer intelligence, inventory intelligence).
 * Deliberately not a dependency on a numerics/ML library — every method
 * here is a few lines of arithmetic and matches the rest of the codebase's
 * "no heavy dependency for a simple need" convention (see the TOTP/CSV/
 * provider-fallback comments elsewhere).
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
}

/** Ordinary least squares over (index, value) pairs — index is the period offset 0, 1, 2, ... */
export function linearRegression(values: number[]): LinearRegressionResult {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0]! };

  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i]! - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

export function predictLinear(regression: LinearRegressionResult, index: number): number {
  return regression.intercept + regression.slope * index;
}

/**
 * Forecasts the next `periodsAhead` values from a trailing history series.
 * Blends the linear trend (captures growth/decline) with the trailing
 * simple moving average (dampens single-point noise), weighted 60/40
 * toward the trend. Never predicts below zero — revenue/order-count/demand
 * series have no meaningful negative values.
 */
export function forecastNextValues(history: number[], periodsAhead: number): number[] {
  if (history.length === 0) return Array<number>(periodsAhead).fill(0);
  const regression = linearRegression(history);
  const window = Math.min(7, history.length);
  const trailingAvg = mean(history.slice(-window));

  const predictions: number[] = [];
  for (let step = 1; step <= periodsAhead; step++) {
    const trendValue = predictLinear(regression, history.length - 1 + step);
    const blended = trendValue * 0.6 + trailingAvg * 0.4;
    predictions.push(Math.max(0, blended));
  }
  return predictions;
}

/**
 * 0-1 confidence score for a forecast derived from `history`: rewards a
 * longer trailing window and penalizes high volatility relative to the
 * mean (coefficient of variation). Clamped to [0.1, 0.95] — never fully
 * certain, never fully worthless, so the admin UI always has something
 * meaningful to render as a confidence bar.
 */
export function confidenceScore(history: number[]): number {
  if (history.length < 2) return 0.3;
  const m = mean(history);
  if (m === 0) return 0.3;
  const coefficientOfVariation = stdDev(history) / m;
  const volatilityScore = 1 / (1 + coefficientOfVariation);
  const sampleSizeScore = Math.min(1, history.length / 30);
  const raw = volatilityScore * 0.7 + sampleSizeScore * 0.3;
  return Math.round(Math.min(0.95, Math.max(0.1, raw)) * 1000) / 1000;
}

/**
 * Assigns a 1-5 quintile score to `value` within `sortedAsc` (ascending,
 * pre-sorted by the caller once per metric rather than per customer) — the
 * standard RFM scoring approach. `higherIsBetter` is false for recency
 * (fewer days since last order is better) and true for frequency/monetary.
 */
export function quantileScore(sortedAsc: number[], value: number, higherIsBetter: boolean): number {
  if (sortedAsc.length <= 1) return 3;
  let rank = 0;
  for (const v of sortedAsc) {
    if (v <= value) rank++;
    else break;
  }
  const percentile = rank / sortedAsc.length;
  const score = Math.min(5, Math.max(1, Math.ceil(percentile * 5)));
  return higherIsBetter ? score : 6 - score;
}

/** Simple hour-of-day / day-of-week seasonal index: value at each bucket relative to the overall mean. */
export function seasonalIndex(bucketed: Map<number, number[]>): Map<number, number> {
  const overallValues = Array.from(bucketed.values()).flat();
  const overallMean = mean(overallValues) || 1;
  const index = new Map<number, number>();
  for (const [bucket, values] of bucketed.entries()) {
    index.set(bucket, mean(values) / overallMean);
  }
  return index;
}
