// Phase 9 Task 2 — AI CEO Copilot. Mirrors apps/api's
// modules/ai-copilot/ tree; see docs/API_DESIGN.md's Phase 9 Task 2
// section for the endpoint catalog. Every field here mirrors a real
// Prisma model or service-layer interface in that module — nothing here
// is invented for the admin UI.

export type AiCopilotPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type HealthTrend = "IMPROVING" | "STABLE" | "DECLINING";
export type ExecutiveAlertStatus = "ACTIVE" | "RESOLVED" | "DISMISSED";

// --- Feature 1: Morning Executive Briefing ---

export interface ExecutiveBriefing {
  id: string;
  organizationId: string;
  branchId: string | null;
  briefingDate: string;
  revenueSummary: { currentRevenue: number };
  profitSummary: { currentProfit: number };
  topProducts: unknown[];
  bottomProducts: unknown[];
  inventoryAlerts: unknown[];
  staffingAlerts: {
    date: string;
    dayOfWeek: string;
    scheduledShifts: number;
    message: string;
  }[];
  aiRecommendations: {
    title: string;
    description: string;
    impact: string;
    confidence: number;
    priority: AiCopilotPriority;
  }[];
  riskLevel: AiCopilotPriority;
  confidenceScore: number;
  createdAt: string;
}

// --- Feature 2: Business Health Score ---

export interface BusinessHealthSnapshot {
  id: string;
  organizationId: string;
  branchId: string | null;
  overallScore: number;
  revenueScore: number;
  profitScore: number;
  inventoryScore: number;
  customerScore: number;
  operationsScore: number;
  staffScore: number;
  trend: HealthTrend;
  createdAt: string;
}

// --- Feature 3: Anomaly Detection ---

export interface ExecutiveAlert {
  id: string;
  organizationId: string;
  branchId: string | null;
  type: string;
  severity: AiCopilotPriority;
  confidence: number;
  evidence: { source: string; detail: string }[];
  recommendedAction: string;
  status: ExecutiveAlertStatus;
  createdAt: string;
}

// --- Feature 4: Executive Dashboard ---

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

export interface AiCopilotPrediction {
  metric: string;
  forecast: number;
  confidence: number;
  period: string;
}

export interface AiCopilotDecision {
  id: string;
  organizationId: string;
  decisionType: string;
  priority: AiCopilotPriority;
  input: unknown;
  output: unknown;
  confidence: number;
  createdAt: string;
}

export interface ExecutiveDashboardResult {
  overview: ExecutiveDashboardOverview;
  kpis: DashboardKpi[];
  healthScore: BusinessHealthSnapshot;
  activeAlerts: ExecutiveAlert[];
  aiRecommendations: PriorityRecommendation[];
  predictions: AiCopilotPrediction[];
  priorityActions: AiCopilotDecision[];
}

// --- Feature 5: Recommendation Prioritization ---

export type PriorityRecommendationSource =
  "ai-brain" | "executive-analytics" | "forecast" | "inventory";

export interface PriorityRecommendation {
  source: PriorityRecommendationSource;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  priority: AiCopilotPriority;
}

// --- Feature 6: Natural Executive Summary ---

export type ExecutiveSummaryPeriod = "day" | "week";

export interface ExecutiveSummary {
  id: string;
  organizationId: string;
  branchId: string | null;
  period: string;
  content: string;
  keyMetrics: {
    revenueChangePct: number;
    inventoryCostChangePct: number;
    demandSignal: string | null;
    topRecommendation: string | null;
  };
  createdAt: string;
}
