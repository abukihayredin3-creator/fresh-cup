import type { AiDecision, BusinessHealthSnapshot, ExecutiveAlert } from "@prisma/client";
import type { PredictionResult } from "../../ai-brain/interfaces/ai-brain.interfaces";
import type { PriorityRecommendation } from "./ai-copilot.interfaces";

export interface DashboardKpi {
  label: string;
  value: number;
}

export interface ExecutiveDashboardOverview {
  totalRevenue: number;
  totalEstimatedProfit: number;
  repeatCustomerRate: number;
  conversionRate: number;
}

export interface ExecutiveDashboardResult {
  overview: ExecutiveDashboardOverview;
  kpis: DashboardKpi[];
  healthScore: BusinessHealthSnapshot;
  activeAlerts: ExecutiveAlert[];
  aiRecommendations: PriorityRecommendation[];
  predictions: PredictionResult[];
  priorityActions: AiDecision[];
}
