import { scoreFromWeights, sigmoid, topReasons } from "./feature-scoring.util";

describe("sigmoid", () => {
  it("returns 0.5 at x=0", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 5);
  });

  it("approaches 1 for large positive x and 0 for large negative x", () => {
    expect(sigmoid(20)).toBeGreaterThan(0.999);
    expect(sigmoid(-20)).toBeLessThan(0.001);
  });
});

describe("scoreFromWeights", () => {
  it("computes a weighted sum through a sigmoid", () => {
    const result = scoreFromWeights(
      { recencyDays: 90, ordersCount: 1 },
      { recencyDays: 0.05, ordersCount: -0.5 },
    );
    expect(result.score).toBeCloseTo(sigmoid(90 * 0.05 + 1 * -0.5), 10);
  });

  it("treats a missing feature as 0", () => {
    const result = scoreFromWeights({}, { recencyDays: 0.05 });
    expect(result.score).toBeCloseTo(sigmoid(0), 10);
  });

  it("sorts contributions by absolute magnitude, largest first", () => {
    const result = scoreFromWeights({ a: 1, b: 10, c: -2 }, { a: 1, b: 0.5, c: 3 });
    // contributions: a=1, b=5, c=-6
    expect(result.contributions.map((c) => c.feature)).toEqual(["c", "b", "a"]);
  });

  it("labels contribution direction correctly", () => {
    const result = scoreFromWeights({ a: 1, b: 1 }, { a: 1, b: -1 });
    const byFeature = Object.fromEntries(result.contributions.map((c) => [c.feature, c.direction]));
    expect(byFeature.a).toBe("positive");
    expect(byFeature.b).toBe("negative");
  });

  it("applies the bias term", () => {
    const withoutBias = scoreFromWeights({ a: 0 }, { a: 1 }, 0);
    const withBias = scoreFromWeights({ a: 0 }, { a: 1 }, 5);
    expect(withBias.score).toBeGreaterThan(withoutBias.score);
  });
});

describe("topReasons", () => {
  it("returns human-readable strings for the top-N contributions", () => {
    const { contributions } = scoreFromWeights(
      { recencyDays: 90, ordersCount: 8 },
      { recencyDays: 0.05, ordersCount: -0.3 },
    );
    const reasons = topReasons(contributions, 2);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toMatch(/increases|decreases/);
  });

  it("defaults to 3 reasons", () => {
    const { contributions } = scoreFromWeights(
      { a: 1, b: 1, c: 1, d: 1 },
      { a: 1, b: 2, c: 3, d: 4 },
    );
    expect(topReasons(contributions)).toHaveLength(3);
  });
});
