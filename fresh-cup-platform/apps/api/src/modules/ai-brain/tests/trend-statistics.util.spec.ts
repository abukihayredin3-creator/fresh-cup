import { buildDailySeries, linearForecast, toDateKey } from "../services/trend-statistics.util";

const TRAILING_WINDOW = 14;

describe("linearForecast", () => {
  it("returns zero forecast with low confidence for an empty series", () => {
    const result = linearForecast([]);
    expect(result.forecast).toBe(0);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("projects a rising trend upward past the last observed value", () => {
    const series = [10, 12, 14, 16, 18, 20];
    const result = linearForecast(series);
    expect(result.forecast).toBeGreaterThan(20);
  });

  it("forecasts flat for a constant series with high confidence", () => {
    const series = new Array(TRAILING_WINDOW).fill(50);
    const result = linearForecast(series);
    expect(result.forecast).toBeCloseTo(50, 0);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("never returns a negative forecast for a sharply declining series", () => {
    const series = [100, 60, 20, -10, -50];
    const result = linearForecast(series);
    expect(result.forecast).toBeGreaterThanOrEqual(0);
  });

  it("clamps confidence to the [0.3, 0.95] range", () => {
    const noisy = [5, 95, 2, 88, 10, 76, 3];
    const result = linearForecast(noisy);
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });
});

describe("buildDailySeries", () => {
  it("fills days with no data as 0, preserving chronological order", () => {
    const today = toDateKey(new Date());
    const series = buildDailySeries(new Map([[today, 42]]), 3);
    expect(series).toHaveLength(3);
    expect(series[series.length - 1]).toBe(42);
    expect(series[0]).toBe(0);
  });
});
