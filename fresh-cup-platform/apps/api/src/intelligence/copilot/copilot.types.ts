import type { AgentAnswer } from "../agents/agent.types";
import type { DecisionReport } from "../decision-engine/decision-engine.types";
import type { PredictionResultDto } from "../prediction/dto/prediction-result.dto";

export interface CopilotStep {
  step: "collect" | "analyze_compare" | "forecast" | "explain" | "recommend";
  label: string;
  tookMs: number;
  summary: string;
}

export interface CopilotRecommendation {
  action: string;
  expectedImpactEtb?: number;
  confidence: number;
}

export interface CopilotResponse {
  question: string;
  branchId?: string;
  steps: CopilotStep[];
  agentAnswers: AgentAnswer[];
  decisionReport: DecisionReport | null;
  forecast: PredictionResultDto | null;
  explanation: string;
  recommendations: CopilotRecommendation[];
  confidence: number;
  generatedAt: string;
}
