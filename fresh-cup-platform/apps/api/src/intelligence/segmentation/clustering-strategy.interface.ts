export const SEGMENT_LABELS = [
  "VIP",
  "High Value",
  "Occasional",
  "New",
  "Dormant",
  "At Risk",
  "Lost",
] as const;

export type SegmentLabel = (typeof SEGMENT_LABELS)[number];

export interface CustomerVector {
  userId: string;
  fullName: string;
  recencyDays: number;
  ordersCount: number;
  totalSpendEtb: number;
}

export interface ClusterAssignment {
  userId: string;
  fullName: string;
  segment: SegmentLabel;
}

/**
 * Configurable clustering strategy — `CustomerSegmentationService` picks
 * an implementation by name, so the assignment algorithm is a config
 * choice, not a code change. `rule-based` (default) is deterministic and
 * auditable; `kmeans` is a genuine unsupervised alternative for
 * comparison.
 */
export interface ClusteringStrategy {
  readonly name: string;
  cluster(vectors: CustomerVector[]): ClusterAssignment[];
}
