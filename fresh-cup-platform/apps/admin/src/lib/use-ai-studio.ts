import type {
  ApprovalActionType,
  ApprovalStatus,
  RecommendationOutcomeStatus,
  ScenarioType,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

// --- Human Approval Layer ---

export function useApprovals(status?: ApprovalStatus, actionType?: ApprovalActionType) {
  return useQuery({
    queryKey: ["admin-ai-approvals", status, actionType],
    queryFn: () => api.admin.aiStudio.listApprovals(status, actionType),
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.admin.aiStudio.approveRequest(id, notes),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.admin.aiStudio.rejectRequest(id, notes),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

// --- Multi-Agent AI ---

export function useAgentsList() {
  return useQuery({
    queryKey: ["admin-ai-agents"],
    queryFn: () => api.admin.aiStudio.listAgents(),
  });
}

export function useAskAgents() {
  return useMutation({
    mutationFn: ({ question, branchId }: { question: string; branchId?: string }) =>
      api.admin.aiStudio.askAgents(question, branchId),
  });
}

// --- Executive Copilot ---

export function useAskCopilot() {
  return useMutation({
    mutationFn: ({ question, branchId }: { question: string; branchId?: string }) =>
      api.admin.aiStudio.askCopilot(question, branchId),
  });
}

// --- AI Knowledge Base ---

export function useKnowledgeDocuments(category?: string) {
  return useQuery({
    queryKey: ["admin-ai-knowledge", category],
    queryFn: () => api.admin.aiStudio.listKnowledgeDocuments(category),
  });
}

export function useSearchKnowledgeBase(query: string) {
  return useQuery({
    queryKey: ["admin-ai-knowledge-search", query],
    queryFn: () => api.admin.aiStudio.searchKnowledgeBase(query),
    enabled: query.length > 0,
  });
}

export function useCreateKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.admin.aiStudio.createKnowledgeDocument.bind(api.admin.aiStudio),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-knowledge"] }),
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.aiStudio.deleteKnowledgeDocument(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-knowledge"] }),
  });
}

// --- AI Workflow Engine + Automation ---

export function useWorkflowDefinitions() {
  return useQuery({
    queryKey: ["admin-ai-workflow-definitions"],
    queryFn: () => api.admin.aiStudio.listWorkflowDefinitions(),
  });
}

export function useWorkflowRuns(workflowId?: string) {
  return useQuery({
    queryKey: ["admin-ai-workflow-runs", workflowId],
    queryFn: () => api.admin.aiStudio.listWorkflowRuns(workflowId),
  });
}

export function useRunLowStockReorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) => api.admin.aiStudio.runLowStockReorderWorkflow(branchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-workflow-runs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] });
    },
  });
}

export function useDraftMarketingCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.admin.aiStudio.draftMarketingCampaign(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

export function useDraftCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.admin.aiStudio.draftCoupon(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

export function useDraftPromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.admin.aiStudio.draftPromotion(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

export function useDraftKitchenStaffing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId?: string) => api.admin.aiStudio.draftKitchenStaffing(branchId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

export function useDraftDeliveryStaffing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId?: string) => api.admin.aiStudio.draftDeliveryStaffing(branchId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

export function useDraftEmployeeScheduling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId?: string) => api.admin.aiStudio.draftEmployeeScheduling(branchId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-ai-approvals"] }),
  });
}

// --- Scenario Simulator + Digital Twin ---

export function useRunScenario() {
  return useMutation({
    mutationFn: ({
      type,
      magnitudePercent,
      branchId,
    }: {
      type: ScenarioType;
      magnitudePercent: number;
      branchId?: string;
    }) => api.admin.aiStudio.runScenario(type, magnitudePercent, branchId),
  });
}

export function useRunDigitalTwin() {
  return useMutation({
    mutationFn: ({
      type,
      magnitudePercent,
      branchId,
      horizonDays,
      rampDays,
    }: {
      type: ScenarioType;
      magnitudePercent: number;
      branchId?: string;
      horizonDays?: number;
      rampDays?: number;
    }) =>
      api.admin.aiStudio.runDigitalTwin(type, magnitudePercent, branchId, horizonDays, rampDays),
  });
}

// --- Continuous Evaluation ---

export function useEvaluationTrend(metricName: string, modelKey?: string) {
  return useQuery({
    queryKey: ["admin-ai-evaluation-trend", metricName, modelKey],
    queryFn: () => api.admin.aiStudio.evaluationTrend(metricName, modelKey),
    enabled: metricName.length > 0,
  });
}

export function useAcceptanceRate(source?: string) {
  return useQuery({
    queryKey: ["admin-ai-acceptance-rate", source],
    queryFn: () => api.admin.aiStudio.acceptanceRate(source),
  });
}

export function useBusinessImpact(source?: string) {
  return useQuery({
    queryKey: ["admin-ai-business-impact", source],
    queryFn: () => api.admin.aiStudio.businessImpact(source),
  });
}

export function useDecideRecommendationOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      actualImpact,
    }: {
      id: string;
      status: RecommendationOutcomeStatus;
      actualImpact?: number;
    }) => api.admin.aiStudio.decideRecommendationOutcome(id, status, actualImpact),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-acceptance-rate"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-business-impact"] });
    },
  });
}

// --- AI Governance ---

export function usePrompts() {
  return useQuery({
    queryKey: ["admin-ai-prompts"],
    queryFn: () => api.admin.aiStudio.listPrompts(),
  });
}

export function useEvaluatePolicy() {
  return useMutation({
    mutationFn: ({
      actionType,
      payload,
    }: {
      actionType: ApprovalActionType;
      payload: Record<string, unknown>;
    }) => api.admin.aiStudio.evaluatePolicy(actionType, payload),
  });
}
