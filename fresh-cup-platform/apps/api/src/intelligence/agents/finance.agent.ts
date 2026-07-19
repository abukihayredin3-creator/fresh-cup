import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ExecutiveAiService } from "../services/executive-ai/executive-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

/**
 * There is no separate "finance" domain AI service — Phase 11 Part 3's
 * spec lists a Finance Agent alongside an Executive Agent, but this
 * platform's only money-focused reasoning lives in `ExecutiveAiService`
 * (revenue explanation, growth/margin opportunities). Rather than
 * building a duplicate finance engine, FinanceAgent wraps that same
 * service's money-focused methods; ExecutiveAgent wraps its
 * health/anomaly-focused ones — a deliberate scope decision, documented
 * here rather than silently reusing identical logic under two names.
 */
@Injectable()
export class FinanceAgent implements DomainAgent {
  readonly key = "finance";
  readonly name = "Finance Agent";
  readonly domain = "finance";
  readonly keywords = [
    "finance",
    "financial",
    "profit",
    "margin",
    "cost",
    "revenue",
    "budget",
    "roi",
  ] as const;

  constructor(private readonly executiveAi: ExecutiveAiService) {}

  async answer(
    actor: RequestUser,
    branchId: string | undefined,
    _question?: string,
  ): Promise<AgentAnswer> {
    const [revenue, growth] = await Promise.all([
      this.executiveAi.revenueExplanation(actor, branchId),
      this.executiveAi.growthOpportunities(actor),
    ]);
    const insights = toInsightList(revenue, growth);
    return {
      agentKey: this.key,
      agentName: this.name,
      domain: this.domain,
      summary: summarizeInsights(insights),
      confidence: averageConfidence(insights),
      insights,
    };
  }
}
