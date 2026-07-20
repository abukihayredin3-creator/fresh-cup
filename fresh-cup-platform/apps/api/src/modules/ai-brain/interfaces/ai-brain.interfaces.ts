import type { AiPriority } from "@prisma/client";

/**
 * Shared value types passed between the AI Brain engines. Kept independent
 * of the Prisma models (AiInsight/AiMemory/AiRecommendation/AiDecision) so
 * an engine's internal reasoning shape can evolve without forcing a schema
 * migration — the services translate to/from Prisma at the persistence
 * boundary only.
 */

export interface MemoryEventInput {
  branchId?: string | null;
  memoryType: string;
  data: Record<string, unknown>;
  /** 0-1. Higher-importance memories surface first in recall(). Defaults to 0.5. */
  importance?: number;
}

export interface MemoryQuery {
  branchId?: string;
  memoryType?: string;
  minImportance?: number;
  cursor?: string;
  limit: number;
}

export type ReasoningCategory = "sales" | "inventory" | "customer" | "operational";

export interface ReasoningEvidence {
  /** Where this evidence came from, e.g. "Order aggregate (last 7 days)". */
  source: string;
  detail: string;
}

export interface LowStockSignal {
  id: string;
  name: string;
  currentStock: number;
  reorderThreshold: number;
}

export interface SalesTrendSignal {
  currentRevenue: number;
  previousRevenue: number;
  revenueChangePct: number;
  currentOrderCount: number;
  previousOrderCount: number;
  orderChangePct: number;
}

export interface CustomerTrendSignal {
  currentCustomers: number;
  previousCustomers: number;
  customerChangePct: number;
  repeatChangePct: number;
}

export interface OperationalSignal {
  memoryType: string;
  importance: number;
  createdAt: string;
}

/**
 * The raw structured numbers a reasoning analysis was built from — kept
 * alongside the human-readable `causes` strings so RecommendationEngineService
 * can derive actions directly from real data instead of parsing prose.
 */
export type ReasoningSignals =
  | { kind: "sales"; trend: SalesTrendSignal }
  | { kind: "inventory"; lowStock: LowStockSignal[] }
  | { kind: "customer"; trend: CustomerTrendSignal }
  | { kind: "operational"; events: OperationalSignal[] };

/** Reasoning Engine output — a structured analysis of a business situation. */
export interface ReasoningResult {
  category: ReasoningCategory;
  problem: string;
  causes: string[];
  confidence: number;
  evidence: ReasoningEvidence[];
  signals: ReasoningSignals;
}

export type PredictionMetric = "sales" | "inventory_demand" | "customer_demand";

export interface PredictionRequest {
  organizationId: string;
  branchId?: string;
  metric: PredictionMetric;
  /** Free-form label for the forecast window, e.g. "tomorrow", "next_7_days". */
  period?: string;
}

/** Prediction Engine output. */
export interface PredictionResult {
  metric: string;
  forecast: number;
  confidence: number;
  period: string;
}

/** Recommendation Engine output, before persistence assigns it an id/status. */
export interface RecommendationCandidate {
  title: string;
  description: string;
  impact: string;
  confidence: number;
  priority: AiPriority;
}

/** Decision Engine output, before persistence assigns it an id. */
export interface DecisionResult {
  decisionType: string;
  priority: AiPriority;
  action: string;
  reason: string;
  confidence: number;
}

/** Learning Engine input — the observed outcome of a recommendation. */
export interface LearningFeedbackInput {
  recommendationId: string;
  result: string;
  feedback: Record<string, unknown>;
}
