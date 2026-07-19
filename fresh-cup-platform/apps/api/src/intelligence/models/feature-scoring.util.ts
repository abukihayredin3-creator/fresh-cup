/**
 * Generic weighted-feature scoring — the "model" every binary-outcome
 * prediction in prediction/customer-prediction.service.ts is built from:
 * a fixed, documented weight vector (hand-tuned, not fit by gradient
 * descent — same "no Python ML service" transparency as Phase 6's
 * hand-rolled statistics) dotted with a feature vector, squashed through
 * a sigmoid. What makes it explainable is structural: every weighted term
 * is a named contribution, so "top reasons" falls out of the same
 * computation that produced the score, never a separate guess.
 */
export interface FeatureContribution {
  feature: string;
  value: number;
  weight: number;
  contribution: number;
  direction: "positive" | "negative";
}

export interface ScoringResult {
  /** Sigmoid output, 0-1. */
  score: number;
  /** Sorted by |contribution| descending. */
  contributions: FeatureContribution[];
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function scoreFromWeights(
  features: Record<string, number>,
  weights: Record<string, number>,
  bias = 0,
): ScoringResult {
  let z = bias;
  const contributions: FeatureContribution[] = [];

  for (const [feature, weight] of Object.entries(weights)) {
    const value = features[feature] ?? 0;
    const contribution = weight * value;
    z += contribution;
    contributions.push({
      feature,
      value,
      weight,
      contribution,
      direction: contribution >= 0 ? "positive" : "negative",
    });
  }

  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return { score: sigmoid(z), contributions };
}

/** Turns the top-N contributions into human-readable reason strings, most influential first. */
export function topReasons(contributions: FeatureContribution[], n = 3): string[] {
  return contributions
    .slice(0, n)
    .map(
      (c) =>
        `${c.feature} (${c.value.toFixed(2)}) ${c.direction === "positive" ? "increases" : "decreases"} this prediction`,
    );
}
