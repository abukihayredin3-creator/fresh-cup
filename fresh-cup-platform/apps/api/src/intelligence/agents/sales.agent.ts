import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SalesAiService } from "../services/sales-ai/sales-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

@Injectable()
export class SalesAgent implements DomainAgent {
  readonly key = "sales";
  readonly name = "Sales Agent";
  readonly domain = "sales";
  readonly keywords = [
    "sales",
    "revenue",
    "demand",
    "forecast",
    "best seller",
    "bestseller",
    "ticket",
    "peak hour",
    "transactions",
  ] as const;

  constructor(private readonly salesAi: SalesAiService) {}

  async answer(_actor: RequestUser, branchId: string | undefined): Promise<AgentAnswer> {
    const [demand, bestSellers, peakHour] = await Promise.all([
      this.salesAi.demandForecast(branchId),
      this.salesAi.bestSellerPrediction(branchId),
      this.salesAi.peakHourPrediction(branchId),
    ]);
    const insights = toInsightList(demand, bestSellers, peakHour);
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
