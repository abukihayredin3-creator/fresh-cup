import {
  confidenceScore,
  forecastNextValues,
  linearRegression,
  mean,
  quantileScore,
  seasonalIndex,
  stdDev,
} from "./stats.util";

describe("stats.util", () => {
  describe("mean", () => {
    it("averages a series", () => {
      expect(mean([1, 2, 3, 4])).toBe(2.5);
    });

    it("returns 0 for an empty series", () => {
      expect(mean([])).toBe(0);
    });
  });

  describe("stdDev", () => {
    it("returns 0 for fewer than two points", () => {
      expect(stdDev([5])).toBe(0);
      expect(stdDev([])).toBe(0);
    });

    it("computes sample standard deviation", () => {
      expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    });
  });

  describe("linearRegression", () => {
    it("fits a perfect upward trend", () => {
      const { slope, intercept } = linearRegression([10, 20, 30, 40]);
      expect(slope).toBeCloseTo(10, 5);
      expect(intercept).toBeCloseTo(10, 5);
    });

    it("fits a flat series with zero slope", () => {
      const { slope } = linearRegression([5, 5, 5, 5]);
      expect(slope).toBeCloseTo(0, 5);
    });

    it("handles a single point as a flat intercept", () => {
      expect(linearRegression([42])).toEqual({ slope: 0, intercept: 42 });
    });
  });

  describe("forecastNextValues", () => {
    it("continues an upward trend (blended with the trailing average) and never predicts below zero", () => {
      const predictions = forecastNextValues([10, 20, 30, 40, 50], 3);
      expect(predictions).toHaveLength(3);
      // 60% trend / 40% trailing-average blend, so each step lands between
      // the trailing average (30) and a pure trend extrapolation (60+).
      expect(predictions[0]!).toBeGreaterThan(30);
      expect(predictions[0]!).toBeLessThan(60);
      expect(predictions[2]!).toBeGreaterThan(predictions[0]!);
      expect(predictions.every((v) => v >= 0)).toBe(true);
    });

    it("returns zeros for empty history", () => {
      expect(forecastNextValues([], 4)).toEqual([0, 0, 0, 0]);
    });

    it("never predicts negative values from a downward trend", () => {
      const predictions = forecastNextValues([100, 50, 10, 2], 5);
      expect(predictions.every((v) => v >= 0)).toBe(true);
    });
  });

  describe("confidenceScore", () => {
    it("is low for short history", () => {
      expect(confidenceScore([10])).toBe(0.3);
    });

    it("is higher for a long, stable series than a short, volatile one", () => {
      const stable = Array.from({ length: 30 }, () => 100);
      const volatile = [10, 90, 5, 95];
      expect(confidenceScore(stable)).toBeGreaterThan(confidenceScore(volatile));
    });

    it("is always clamped between 0.1 and 0.95", () => {
      const perfectlyStableLong = Array.from({ length: 200 }, () => 50);
      expect(confidenceScore(perfectlyStableLong)).toBeLessThanOrEqual(0.95);
      const wildlyVolatile = [1, 1000, 1, 1000, 1, 1000];
      expect(confidenceScore(wildlyVolatile)).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("quantileScore", () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    it("gives the lowest value the lowest score when higher is better", () => {
      expect(quantileScore(sorted, 10, true)).toBeLessThanOrEqual(2);
    });

    it("gives the highest value the highest score when higher is better", () => {
      expect(quantileScore(sorted, 100, true)).toBe(5);
    });

    it("inverts the score when higher is worse (e.g. recency)", () => {
      const lowScore = quantileScore(sorted, 10, false);
      const highScore = quantileScore(sorted, 100, false);
      expect(lowScore).toBeGreaterThan(highScore);
    });

    it("returns the midpoint for a degenerate single-value population", () => {
      expect(quantileScore([42], 42, true)).toBe(3);
    });
  });

  describe("seasonalIndex", () => {
    it("scores an above-average bucket above 1 and a below-average bucket below 1", () => {
      const index = seasonalIndex(
        new Map([
          [12, [100, 100]],
          [3, [10, 10]],
        ]),
      );
      expect(index.get(12)!).toBeGreaterThan(1);
      expect(index.get(3)!).toBeLessThan(1);
    });
  });
});
