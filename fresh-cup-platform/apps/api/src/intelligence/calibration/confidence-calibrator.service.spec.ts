import { ConfidenceCalibratorService } from "./confidence-calibrator.service";

describe("ConfidenceCalibratorService", () => {
  const calibrator = new ConfidenceCalibratorService();

  describe("normalize", () => {
    it("clamps to [0.05, 0.95]", () => {
      expect(calibrator.normalize(1.5)).toBe(0.95);
      expect(calibrator.normalize(-0.5)).toBe(0.05);
      expect(calibrator.normalize(0.5)).toBe(0.5);
    });

    it("treats NaN as the minimum confidence", () => {
      expect(calibrator.normalize(NaN)).toBe(0.05);
    });
  });

  describe("calibrate", () => {
    it("falls back to normalize() when no calibration model is available", () => {
      expect(calibrator.calibrate(0.7)).toBe(0.7);
      expect(calibrator.calibrate(0.7, null)).toBe(0.7);
    });

    it("replaces a raw score with its bin's empirical actual-rate when overconfident", () => {
      // Historically, predictions around 0.9 only came true 30% of the time.
      const predicted = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
      const actual = [true, true, true, false, false, false, false, false, false, false];
      const model = calibrator.buildCalibrationModel("churn", predicted, actual);

      const calibrated = calibrator.calibrate(0.9, model);
      expect(calibrated).toBeCloseTo(0.3, 5);
    });

    it("falls back to the last bin for a score above every bin's range", () => {
      const model = calibrator.buildCalibrationModel("churn", [0.1, 0.1], [false, true]);
      const calibrated = calibrator.calibrate(0.99, model);
      expect(calibrated).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe("rejectLowConfidence", () => {
    it("filters out items below the threshold", () => {
      const items = [{ confidence: 0.9 }, { confidence: 0.3 }, { confidence: 0.5 }];
      expect(calibrator.rejectLowConfidence(items)).toEqual([
        { confidence: 0.9 },
        { confidence: 0.5 },
      ]);
    });

    it("respects a custom threshold", () => {
      const items = [{ confidence: 0.6 }, { confidence: 0.3 }];
      expect(calibrator.rejectLowConfidence(items, 0.5)).toEqual([{ confidence: 0.6 }]);
    });
  });
});
