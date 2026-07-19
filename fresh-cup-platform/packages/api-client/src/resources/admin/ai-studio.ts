import type {
  AcceptanceRate,
  AiApprovalRequest,
  AiEvaluationRecord,
  AiKnowledgeDocument,
  AiRecommendationOutcome,
  AiWorkflowDefinition,
  AiWorkflowRun,
  AgentSummary,
  ApprovalActionType,
  ApprovalStatus,
  BusinessImpact,
  CoordinatorResult,
  CopilotResponse,
  DecisionReport,
  DigitalTwinResult,
  ExportedFile,
  KnowledgeSourceFormat,
  PolicyDecision,
  PromptRecord,
  RecommendationOutcomeStatus,
  ScenarioResult,
  ScenarioType,
  SlideOutline,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString } from "../../query";

/** Phase 11 Part 3 — Autonomous Restaurant Intelligence Platform ("AI Studio") admin resources. */
export class AdminAiStudioResource {
  constructor(private readonly client: ApiClient) {}

  // --- Human Approval Layer ---
  listApprovals(
    status?: ApprovalStatus,
    actionType?: ApprovalActionType,
  ): Promise<AiApprovalRequest[]> {
    return this.client.request(`/admin/ai/approvals${toQueryString({ status, actionType })}`);
  }

  approveRequest(
    id: string,
    notes?: string,
  ): Promise<AiApprovalRequest & { executionNote: string }> {
    return this.client.request(`/admin/ai/approvals/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  }

  rejectRequest(id: string, notes?: string): Promise<AiApprovalRequest> {
    return this.client.request(`/admin/ai/approvals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  }

  // --- Multi-Agent AI ---
  listAgents(): Promise<AgentSummary[]> {
    return this.client.request("/admin/ai/agents");
  }

  askAgents(question: string, branchId?: string): Promise<CoordinatorResult> {
    return this.client.request("/admin/ai/agents/ask", {
      method: "POST",
      body: JSON.stringify({ question, branchId }),
    });
  }

  // --- Autonomous Decision Engine ---
  detectSalesDrop(branchId?: string, draftApprovals?: boolean): Promise<DecisionReport | null> {
    return this.client.request(
      `/admin/ai/decision-engine/sales-drop${toQueryString({ branchId, draftApprovals: draftApprovals ? "true" : undefined })}`,
    );
  }

  // --- Executive Copilot ---
  askCopilot(question: string, branchId?: string): Promise<CopilotResponse> {
    return this.client.request("/admin/ai/copilot/ask", {
      method: "POST",
      body: JSON.stringify({ question, branchId }),
    });
  }

  exportCopilotCsv(question: string, branchId?: string): Promise<ExportedFile> {
    return this.client.request("/admin/ai/copilot/export/csv", {
      method: "POST",
      body: JSON.stringify({ question, branchId }),
    });
  }

  exportCopilotBriefing(question: string, branchId?: string): Promise<ExportedFile> {
    return this.client.request("/admin/ai/copilot/export/briefing", {
      method: "POST",
      body: JSON.stringify({ question, branchId }),
    });
  }

  exportCopilotSlides(question: string, branchId?: string): Promise<SlideOutline[]> {
    return this.client.request("/admin/ai/copilot/export/slides", {
      method: "POST",
      body: JSON.stringify({ question, branchId }),
    });
  }

  // --- AI Knowledge Base ---
  listKnowledgeDocuments(category?: string): Promise<AiKnowledgeDocument[]> {
    return this.client.request(`/admin/ai/knowledge${toQueryString({ category })}`);
  }

  searchKnowledgeBase(q: string, topK?: number): Promise<AiKnowledgeDocument[]> {
    return this.client.request(`/admin/ai/knowledge/search${toQueryString({ q, topK })}`);
  }

  createKnowledgeDocument(input: {
    title: string;
    category: string;
    content: string;
    sourceFormat?: KnowledgeSourceFormat;
  }): Promise<AiKnowledgeDocument> {
    return this.client.request("/admin/ai/knowledge", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteKnowledgeDocument(id: string): Promise<void> {
    return this.client.request(`/admin/ai/knowledge/${id}`, { method: "DELETE" });
  }

  // --- AI Workflow Engine + Automation ---
  listWorkflowDefinitions(): Promise<AiWorkflowDefinition[]> {
    return this.client.request("/admin/ai/workflows");
  }

  listWorkflowRuns(workflowId?: string): Promise<AiWorkflowRun[]> {
    return this.client.request(`/admin/ai/workflows/runs${toQueryString({ workflowId })}`);
  }

  runLowStockReorderWorkflow(branchId: string): Promise<AiWorkflowRun> {
    return this.client.request("/admin/ai/workflows/low-stock-reorder/run", {
      method: "POST",
      body: JSON.stringify({ branchId }),
    });
  }

  draftMarketingCampaign(): Promise<AiApprovalRequest | null> {
    return this.client.request("/admin/ai/automation/marketing-campaign-draft", { method: "POST" });
  }

  draftCoupon(): Promise<AiApprovalRequest | null> {
    return this.client.request("/admin/ai/automation/coupon-draft", { method: "POST" });
  }

  draftPromotion(): Promise<AiApprovalRequest | null> {
    return this.client.request("/admin/ai/automation/promotion-draft", { method: "POST" });
  }

  draftKitchenStaffing(branchId?: string): Promise<AiApprovalRequest | null> {
    return this.client.request("/admin/ai/automation/kitchen-staffing-draft", {
      method: "POST",
      body: JSON.stringify({ branchId }),
    });
  }

  draftDeliveryStaffing(branchId?: string): Promise<AiApprovalRequest | null> {
    return this.client.request("/admin/ai/automation/delivery-staffing-draft", {
      method: "POST",
      body: JSON.stringify({ branchId }),
    });
  }

  draftEmployeeScheduling(branchId?: string): Promise<AiApprovalRequest | null> {
    return this.client.request("/admin/ai/automation/employee-scheduling-draft", {
      method: "POST",
      body: JSON.stringify({ branchId }),
    });
  }

  // --- Scenario Simulator + Digital Twin ---
  runScenario(
    type: ScenarioType,
    magnitudePercent: number,
    branchId?: string,
  ): Promise<ScenarioResult> {
    return this.client.request("/admin/ai/simulator/scenario", {
      method: "POST",
      body: JSON.stringify({ type, magnitudePercent, branchId }),
    });
  }

  runDigitalTwin(
    type: ScenarioType,
    magnitudePercent: number,
    branchId?: string,
    horizonDays?: number,
    rampDays?: number,
  ): Promise<DigitalTwinResult> {
    return this.client.request("/admin/ai/simulator/digital-twin", {
      method: "POST",
      body: JSON.stringify({ type, magnitudePercent, branchId, horizonDays, rampDays }),
    });
  }

  // --- Continuous Evaluation ---
  evaluationTrend(
    metricName: string,
    modelKey?: string,
    limit?: number,
  ): Promise<AiEvaluationRecord[]> {
    return this.client.request(
      `/admin/ai/evaluations${toQueryString({ metricName, modelKey, limit })}`,
    );
  }

  recordRecommendationOutcome(input: {
    source: string;
    recommendation: string;
    estimatedImpact?: number;
  }): Promise<AiRecommendationOutcome> {
    return this.client.request("/admin/ai/evaluations/recommendations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  decideRecommendationOutcome(
    id: string,
    status: RecommendationOutcomeStatus,
    actualImpact?: number,
  ): Promise<AiRecommendationOutcome> {
    return this.client.request(`/admin/ai/evaluations/recommendations/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ status, actualImpact }),
    });
  }

  flagHallucination(id: string): Promise<AiRecommendationOutcome> {
    return this.client.request(`/admin/ai/evaluations/recommendations/${id}/flag-hallucination`, {
      method: "POST",
    });
  }

  acceptanceRate(source?: string): Promise<AcceptanceRate> {
    return this.client.request(`/admin/ai/evaluations/acceptance-rate${toQueryString({ source })}`);
  }

  businessImpact(source?: string): Promise<BusinessImpact> {
    return this.client.request(`/admin/ai/evaluations/business-impact${toQueryString({ source })}`);
  }

  // --- AI Governance ---
  listPrompts(): Promise<PromptRecord[]> {
    return this.client.request("/admin/ai/governance/prompts");
  }

  evaluatePolicy(
    actionType: ApprovalActionType,
    payload: Record<string, unknown>,
  ): Promise<PolicyDecision> {
    return this.client.request("/admin/ai/governance/policy/evaluate", {
      method: "POST",
      body: JSON.stringify({ actionType, payload }),
    });
  }
}
