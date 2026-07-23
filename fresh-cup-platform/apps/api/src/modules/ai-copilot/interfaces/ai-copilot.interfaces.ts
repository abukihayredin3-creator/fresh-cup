import type { AiPriority } from "@prisma/client";

/** Shared value types passed between AI Copilot services before they're persisted as Prisma rows. */

export interface EvidenceItem {
  source: string;
  detail: string;
}

export interface AlertCandidate {
  type: string;
  severity: AiPriority;
  confidence: number;
  evidence: EvidenceItem[];
  recommendedAction: string;
}

export type PriorityRecommendationSource =
  "ai-brain" | "executive-analytics" | "forecast" | "inventory";

export interface PriorityRecommendation {
  source: PriorityRecommendationSource;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  priority: AiPriority;
}
