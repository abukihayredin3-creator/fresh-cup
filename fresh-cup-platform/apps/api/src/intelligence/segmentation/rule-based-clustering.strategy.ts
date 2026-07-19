import { Injectable } from "@nestjs/common";
import { quantileScore } from "../../modules/intelligence/ml/stats.util";
import type {
  ClusterAssignment,
  ClusteringStrategy,
  CustomerVector,
} from "./clustering-strategy.interface";

/**
 * Default clustering strategy — deterministic RFM-threshold rules against
 * the current customer population's quintiles (reusing Phase 6's
 * `quantileScore`), mapped to a different 7-label taxonomy than Phase 6's
 * own 6-label RFM segments (`CustomerIntelligenceService.segments()`).
 * The two taxonomies intentionally answer different questions — Phase 6's
 * segments feed churn/LTV framing, this one feeds marketing-list-style
 * bucketing (VIP/High Value/Occasional/New/Dormant/At Risk/Lost) — so this
 * recomputes its own thresholds rather than relabeling Phase 6's segments.
 */
@Injectable()
export class RuleBasedClusteringStrategy implements ClusteringStrategy {
  readonly name = "rule-based";

  cluster(vectors: CustomerVector[]): ClusterAssignment[] {
    if (vectors.length === 0) return [];

    const recencyAsc = vectors.map((v) => v.recencyDays).sort((a, b) => a - b);
    const frequencyAsc = vectors.map((v) => v.ordersCount).sort((a, b) => a - b);
    const monetaryAsc = vectors.map((v) => v.totalSpendEtb).sort((a, b) => a - b);

    return vectors.map((v) => {
      const r = quantileScore(recencyAsc, v.recencyDays, false);
      const f = quantileScore(frequencyAsc, v.ordersCount, true);
      const m = quantileScore(monetaryAsc, v.totalSpendEtb, true);

      return { userId: v.userId, fullName: v.fullName, segment: this.label(v, r, f, m) };
    });
  }

  private label(v: CustomerVector, r: number, f: number, m: number): ClusterAssignment["segment"] {
    if (r >= 4 && f >= 5 && m >= 5) return "VIP";
    if (v.recencyDays > 120) return "Lost";
    if (v.recencyDays > 60) return "Dormant";
    if (r <= 2 && f >= 3) return "At Risk";
    if (m >= 4 && f >= 4) return "High Value";
    if (v.ordersCount <= 2 && v.recencyDays <= 30) return "New";
    return "Occasional";
  }
}
