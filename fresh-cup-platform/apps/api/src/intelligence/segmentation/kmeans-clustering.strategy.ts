import { Injectable } from "@nestjs/common";
import {
  SEGMENT_LABELS,
  type ClusterAssignment,
  type ClusteringStrategy,
  type CustomerVector,
  type SegmentLabel,
} from "./clustering-strategy.interface";

const K = 7;
const MAX_ITERATIONS = 50;

type Point = [number, number, number]; // [recencyScore, frequencyScore, monetaryScore], each 0-1, higher = "better"

/**
 * Alternative, swappable clustering strategy — a genuine (if small-scale)
 * Lloyd's-algorithm k-means over min-max-normalized recency/frequency/
 * monetary features, rather than the default's fixed thresholds.
 * Deterministic on purpose: centroids are seeded from evenly-spaced
 * points across the composite-score-sorted population (no RNG), so the
 * same input always produces the same clusters — important for a
 * `ClusteringStrategy` a caller might snapshot/compare over time.
 * Cluster labeling is a documented simplification: unsupervised clusters
 * don't inherently carry business names, so centroids are ranked by
 * composite "value" score and assigned the 7 segment labels in that rank
 * order — a common practical shortcut, not a claim that k-means
 * discovered "VIP" as a concept on its own.
 */
@Injectable()
export class KMeansClusteringStrategy implements ClusteringStrategy {
  readonly name = "kmeans";

  cluster(vectors: CustomerVector[]): ClusterAssignment[] {
    if (vectors.length === 0) return [];
    const k = Math.min(K, vectors.length);
    const points = this.normalizeAll(vectors);

    let centroids = this.seedCentroids(points, k);
    const assignments = new Array<number>(points.length).fill(0);

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      let changed = false;
      for (let i = 0; i < points.length; i++) {
        const cluster = this.nearestCentroid(points[i]!, centroids);
        if (cluster !== assignments[i]) {
          assignments[i] = cluster;
          changed = true;
        }
      }
      if (!changed && iteration > 0) break;
      centroids = this.recomputeCentroids(points, assignments, centroids);
    }

    const labels = this.labelClusters(centroids);
    return vectors.map((v, i) => ({
      userId: v.userId,
      fullName: v.fullName,
      segment: labels[assignments[i]!]!,
    }));
  }

  private normalizeAll(vectors: CustomerVector[]): Point[] {
    const recency = vectors.map((v) => v.recencyDays);
    const frequency = vectors.map((v) => v.ordersCount);
    const monetary = vectors.map((v) => v.totalSpendEtb);
    const range = (values: number[]): [number, number] => [
      Math.min(...values),
      Math.max(...values),
    ];
    const [rMin, rMax] = range(recency);
    const [fMin, fMax] = range(frequency);
    const [mMin, mMax] = range(monetary);
    const scale = (value: number, min: number, max: number) =>
      max === min ? 0.5 : (value - min) / (max - min);

    return vectors.map((v) => [
      1 - scale(v.recencyDays, rMin, rMax), // inverted: recent = high score
      scale(v.ordersCount, fMin, fMax),
      scale(v.totalSpendEtb, mMin, mMax),
    ]);
  }

  private composite(point: Point): number {
    return point[0] + point[1] + point[2];
  }

  private seedCentroids(points: Point[], k: number): Point[] {
    const order = points
      .map((point, index) => ({ index, score: this.composite(point) }))
      .sort((a, b) => b.score - a.score);
    return Array.from({ length: k }, (_, i) => {
      const pos = Math.round((i * (order.length - 1)) / Math.max(1, k - 1));
      return [...points[order[pos]!.index]!] as Point;
    });
  }

  private nearestCentroid(point: Point, centroids: Point[]): number {
    let best = 0;
    let bestDistance = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const distance = this.distance(point, centroids[c]!);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = c;
      }
    }
    return best;
  }

  private distance(a: Point, b: Point): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  }

  private recomputeCentroids(points: Point[], assignments: number[], previous: Point[]): Point[] {
    const sums: Point[] = previous.map(() => [0, 0, 0]);
    const counts = new Array<number>(previous.length).fill(0);

    for (let i = 0; i < points.length; i++) {
      const cluster = assignments[i]!;
      const sum = sums[cluster]!;
      const point = points[i]!;
      sum[0] += point[0];
      sum[1] += point[1];
      sum[2] += point[2];
      counts[cluster]! += 1;
    }

    return sums.map((sum, i) =>
      counts[i]! > 0
        ? ([sum[0] / counts[i]!, sum[1] / counts[i]!, sum[2] / counts[i]!] as Point)
        : previous[i]!,
    );
  }

  /** Ranks centroids by composite score and assigns the 7 segment labels in that order (see class doc comment). */
  private labelClusters(centroids: Point[]): SegmentLabel[] {
    const ranked = centroids
      .map((centroid, index) => ({ index, score: this.composite(centroid) }))
      .sort((a, b) => b.score - a.score);
    const labels = new Array<SegmentLabel>(centroids.length);
    ranked.forEach((r, rank) => {
      labels[r.index] = SEGMENT_LABELS[Math.min(rank, SEGMENT_LABELS.length - 1)]!;
    });
    return labels;
  }
}
