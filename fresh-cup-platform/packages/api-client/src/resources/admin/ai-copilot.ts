import type {
  ExecutiveAlert,
  ExecutiveBriefing,
  ExecutiveDashboardResult,
  ExecutiveSummary,
  ExecutiveSummaryPeriod,
  BusinessHealthSnapshot,
  PriorityRecommendation,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString } from "../../query";

/**
 * Phase 9 Task 2 — AI CEO Copilot. Every method hits an `ai-copilot/*`
 * backend route; all six are GET (the module only reads and assembles —
 * see apps/api/src/modules/ai-copilot/controllers/ai-copilot.controller.ts).
 * `branchId` omitted scopes to the caller's whole organization (or their
 * own branch, for a MANAGER/STAFF actor — enforced server-side).
 */
export class AdminAiCopilotResource {
  constructor(private readonly client: ApiClient) {}

  getDashboard(branchId?: string): Promise<ExecutiveDashboardResult> {
    return this.client.request(`/ai-copilot/dashboard${toQueryString({ branchId })}`);
  }

  getBriefing(branchId?: string): Promise<ExecutiveBriefing> {
    return this.client.request(`/ai-copilot/briefing${toQueryString({ branchId })}`);
  }

  getHealth(branchId?: string): Promise<BusinessHealthSnapshot> {
    return this.client.request(`/ai-copilot/health${toQueryString({ branchId })}`);
  }

  getAlerts(branchId?: string): Promise<ExecutiveAlert[]> {
    return this.client.request(`/ai-copilot/alerts${toQueryString({ branchId })}`);
  }

  getRecommendations(branchId?: string): Promise<PriorityRecommendation[]> {
    return this.client.request(`/ai-copilot/recommendations${toQueryString({ branchId })}`);
  }

  getSummary(branchId?: string, period?: ExecutiveSummaryPeriod): Promise<ExecutiveSummary> {
    return this.client.request(`/ai-copilot/summary${toQueryString({ branchId, period })}`);
  }
}
