import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

/**
 * Phase 9 Task 2 — AI CEO Copilot. Every hook here reads an ai-copilot/*
 * endpoint (see packages/api-client/src/resources/admin/ai-copilot.ts);
 * this module owns no computation of its own.
 */

export function useAiCopilotDashboard(branchId?: string) {
  return useQuery({
    queryKey: ["ai-copilot-dashboard", branchId],
    queryFn: () => api.admin.aiCopilot.getDashboard(branchId),
  });
}

export function useAiCopilotSummary(branchId?: string) {
  return useQuery({
    queryKey: ["ai-copilot-summary", branchId],
    queryFn: () => api.admin.aiCopilot.getSummary(branchId, "week"),
  });
}
