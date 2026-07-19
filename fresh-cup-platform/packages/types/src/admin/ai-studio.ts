// Phase 11 Part 3 — Autonomous Restaurant Intelligence Platform ("AI
// Studio"). Mirrors apps/api's intelligence/{approvals,agents,decision-engine,
// copilot,knowledge-base,workflows,simulator,evaluation-tracker,governance}
// trees; see docs/API_DESIGN.md's Phase 11 Part 3 section for the endpoint
// catalog.

// --- Human Approval Layer ---

export type ApprovalActionType =
  | "REFUND"
  | "DELETE"
  | "DISCOUNT"
  | "PROMOTION"
  | "INVENTORY_PURCHASE_ORDER"
  | "PRICE_CHANGE"
  | "MARKETING_CAMPAIGN"
  | "STAFFING_CHANGE"
  | "OTHER";

export type ApprovalRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AiApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  riskLevel: ApprovalRiskLevel;
  summary: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requestedByAgent: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  branchId: string | null;
  createdAt: string;
}

// --- Multi-Agent AI ---

export interface AiInsight<T = unknown> {
  title: string;
  explanation: string;
  /** 0-1 */
  confidence: number;
  data: T;
  memoryEntryId?: string;
}

export interface AgentSummary {
  key: string;
  name: string;
  domain: string;
  keywords: readonly string[];
}

export interface AgentAnswer {
  agentKey: string;
  agentName: string;
  domain: string;
  summary: string;
  confidence: number;
  insights: AiInsight[];
}

export interface CoordinatorResult {
  question: string;
  routedAgents: string[];
  answers: AgentAnswer[];
  synthesis: string;
  confidence: number;
}

// --- Autonomous Decision Engine ---

export interface DecisionReason {
  factor: string;
  evidence: string;
  confidence: number;
}

export interface DecisionRecommendation {
  action: string;
  expectedImpactEtb: number;
  confidence: number;
  requiresApproval: boolean;
  approvalActionType?: ApprovalActionType;
  approvalRequestId?: string;
}

export interface DecisionReport {
  issue: string;
  metric: string;
  changePercent: number;
  currentValueEtb: number;
  previousValueEtb: number;
  reasons: DecisionReason[];
  recommendations: DecisionRecommendation[];
  totalExpectedImpactEtb: number;
  generatedAt: string;
}

// --- Executive Copilot ---

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

export interface CopilotForecast {
  modelKey: string;
  modelVersion: number;
  prediction: number;
  confidence: number;
  topReasons: string[];
  suggestedAction: string;
}

export interface CopilotResponse {
  question: string;
  branchId?: string;
  steps: CopilotStep[];
  agentAnswers: AgentAnswer[];
  decisionReport: DecisionReport | null;
  forecast: CopilotForecast | null;
  explanation: string;
  recommendations: CopilotRecommendation[];
  confidence: number;
  generatedAt: string;
}

export interface ExportedFile {
  filename: string;
  mimeType: string;
  content: string;
}

export interface SlideOutline {
  title: string;
  bullets: string[];
}

// --- AI Knowledge Base ---

export type KnowledgeSourceFormat = "MARKDOWN" | "PLAIN_TEXT" | "PDF" | "DOCX" | "IMAGE";

export interface AiKnowledgeDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  sourceFormat: KnowledgeSourceFormat;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// --- AI Workflow Engine + Automation ---

export type WorkflowTriggerType = "EVENT" | "SCHEDULE" | "MANUAL";
export type WorkflowRunStatus = "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED";

export interface AiWorkflowDefinition {
  id: string;
  name: string;
  description: string | null;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  steps: { kind: string; description: string }[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiWorkflowRun {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  context: Record<string, unknown>;
  stepLog: { step: string; result: string; at: string }[];
  startedAt: string;
  completedAt: string | null;
}

// --- Scenario Simulator + Digital Twin ---

export type ScenarioType = "price_change" | "promotion" | "staffing_change";

export interface ScenarioProjection {
  metric: "revenue" | "customers" | "profit" | "inventoryDemand";
  baseline: number;
  projected: number;
  changePercent: number;
}

export interface ScenarioResult {
  scenario: { type: ScenarioType; magnitudePercent: number; branchId?: string };
  assumptions: string[];
  projections: ScenarioProjection[];
  confidence: number;
  generatedAt: string;
}

export interface DigitalTwinDay {
  day: number;
  revenueEtb: number;
  customers: number;
  profitEtb: number;
}

export interface DigitalTwinResult {
  scenario: { type: ScenarioType; magnitudePercent: number; branchId?: string };
  finalState: ScenarioResult;
  timeline: DigitalTwinDay[];
}

// --- Continuous Evaluation ---

export interface AiEvaluationRecord {
  id: string;
  metricName: string;
  modelKey: string | null;
  value: number;
  context: Record<string, unknown> | null;
  recordedAt: string;
}

export type RecommendationOutcomeStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "IGNORED";

export interface AiRecommendationOutcome {
  id: string;
  source: string;
  recommendation: string;
  status: RecommendationOutcomeStatus;
  estimatedImpact: number | null;
  actualImpact: number | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  flaggedHallucination: boolean;
  createdAt: string;
}

export interface AcceptanceRate {
  accepted: number;
  rejected: number;
  rate: number;
}

export interface BusinessImpact {
  estimatedTotal: number;
  actualTotal: number;
}

// --- AI Governance ---

export interface PromptRecord {
  domain: string;
  prompt: string;
  fingerprint: string;
}

export interface PolicyDecision {
  blocked: boolean;
  reason?: string;
  escalateTo?: ApprovalRiskLevel;
}
