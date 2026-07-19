import {
  calibrationCurve,
  confusionMatrix,
  f1Score,
  mae,
  mape,
  precision,
  recall,
  rmse,
  rocAuc,
} from "./metrics.util";

describe("confusionMatrix / precision / recall / f1Score", () => {
  const predicted = [true, true, false, false, true];
  const actual = [true, false, false, true, true];
  // tp: idx0, idx4 = 2; fp: idx1 = 1; fn: idx3 = 1; tn: idx2 = 1

  it("computes a confusion matrix", () => {
    const matrix = confusionMatrix(predicted, actual);
    expect(matrix).toEqual({
      truePositive: 2,
      falsePositive: 1,
      trueNegative: 1,
      falseNegative: 1,
    });
  });

  it("computes precision/recall/f1 from the matrix", () => {
    const matrix = confusionMatrix(predicted, actual);
    expect(precision(matrix)).toBeCloseTo(2 / 3, 5);
    expect(recall(matrix)).toBeCloseTo(2 / 3, 5);
    expect(f1Score(matrix)).toBeCloseTo(2 / 3, 5);
  });

  it("returns 0 precision/recall/f1 for an all-negative-prediction matrix", () => {
    const matrix = confusionMatrix([false, false], [true, true]);
    expect(precision(matrix)).toBe(0);
    expect(recall(matrix)).toBe(0);
    expect(f1Score(matrix)).toBe(0);
  });
});

describe("rocAuc", () => {
  it("returns 1 for a perfect separator", () => {
    expect(rocAuc([0.9, 0.8, 0.2, 0.1], [true, true, false, false])).toBe(1);
  });

  it("returns 0 for a perfectly wrong ranking", () => {
    expect(rocAuc([0.1, 0.2, 0.8, 0.9], [true, true, false, false])).toBe(0);
  });

  it("returns 0.5 for indistinguishable scores", () => {
    expect(rocAuc([0.5, 0.5, 0.5, 0.5], [true, false, true, false])).toBe(0.5);
  });

  it("returns 0.5 when only one class is present", () => {
    expect(rocAuc([0.1, 0.9], [true, true])).toBe(0.5);
  });
});

describe("mape / rmse / mae", () => {
  it("computes MAPE as a percentage", () => {
    expect(mape([110], [100])).toBeCloseTo(10, 5);
  });

  it("excludes zero-actual points from MAPE rather than dividing by zero", () => {
    expect(mape([5, 110], [0, 100])).toBeCloseTo(10, 5);
  });

  it("computes RMSE", () => {
    expect(rmse([3, 5], [1, 1])).toBeCloseTo(Math.sqrt((4 + 16) / 2), 5);
  });

  it("computes MAE", () => {
    expect(mae([3, 5], [1, 1])).toBeCloseTo(3, 5);
  });
});

describe("calibrationCurve", () => {
  it("buckets predictions and compares avg predicted vs actual positive rate per bin", () => {
    const predicted = [0.05, 0.15, 0.85, 0.95];
    const actual = [false, false, true, true];
    const curve = calibrationCurve(predicted, actual, 10);

    expect(curve.every((bin) => bin.count > 0)).toBe(true);
    const lowBin = curve.find((b) => b.binStart === 0);
    expect(lowBin?.avgActual).toBe(0);
    const highBin = curve.find((b) => b.binStart === 0.8);
    expect(highBin?.avgActual).toBe(1);
  });

  it("omits empty bins", () => {
    const curve = calibrationCurve([0.5], [true], 10);
    expect(curve).toHaveLength(1);
  });
});
