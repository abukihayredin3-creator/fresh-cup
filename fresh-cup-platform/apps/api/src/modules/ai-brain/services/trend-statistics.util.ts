/** How many trailing days of history feed a forecast — also the cap on data-driven confidence. */
export const TRAILING_WINDOW_DAYS = 14;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Builds a dense (no-gap) daily series over the trailing window, filling silent days with 0. */
export function buildDailySeries(
  values: Map<string, number>,
  windowDays: number = TRAILING_WINDOW_DAYS,
): number[] {
  const today = startOfDay(new Date());
  const series: number[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    series.push(values.get(toDateKey(day)) ?? 0);
  }
  return series;
}

export interface TrendForecast {
  forecast: number;
  confidence: number;
}

/**
 * Ordinary-least-squares trend line over `series` (oldest -> newest),
 * projected one step past the end. Deliberately simple — trailing-average
 * plus linear trend, not a trained model — per Phase 9's "rule-based
 * intelligence, not fake AI" design principle (see ROADMAP.md). Confidence
 * rewards more history and penalizes high dispersion around the trend.
 */
export function linearForecast(series: number[]): TrendForecast {
  const n = series.length;
  if (n === 0) {
    return { forecast: 0, confidence: 0.2 };
  }
  if (n === 1) {
    return { forecast: Math.max(0, series[0] ?? 0), confidence: 0.35 };
  }

  const meanX = (n - 1) / 2;
  const meanY = series.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  series.forEach((y, i) => {
    numerator += (i - meanX) * (y - meanY);
    denominator += (i - meanX) ** 2;
  });
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;
  const forecast = Math.max(0, intercept + slope * n);

  const residuals = series.map((y, i) => y - (intercept + slope * i));
  const meanSquaredError = residuals.reduce((sum, r) => sum + r * r, 0) / n;
  const rootMeanSquaredError = Math.sqrt(meanSquaredError);
  const scale = meanY === 0 ? 1 : meanY;
  const relativeError = Math.min(1, rootMeanSquaredError / scale);
  const dataConfidence = Math.min(1, n / TRAILING_WINDOW_DAYS);
  const confidence = Math.max(0.3, Math.min(0.95, dataConfidence * (1 - relativeError * 0.7)));

  return {
    forecast: Math.round(forecast * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
  };
}
