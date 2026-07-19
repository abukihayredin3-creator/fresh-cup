import type { ApprovalActionType } from "@prisma/client";

export interface DecisionReason {
  factor: string;
  evidence: string;
  confidence: number;
}

export interface DecisionRecommendation {
  action: string;
  /** ETB, positive = expected revenue recovered/gained. */
  expectedImpactEtb: number;
  confidence: number;
  requiresApproval: boolean;
  approvalActionType?: ApprovalActionType;
  approvalRequestId?: string;
}

export interface DecisionReport {
  issue: string;
  metric: string;
  /** Negative = decline. */
  changePercent: number;
  currentValueEtb: number;
  previousValueEtb: number;
  reasons: DecisionReason[];
  recommendations: DecisionRecommendation[];
  totalExpectedImpactEtb: number;
  generatedAt: string;
}
