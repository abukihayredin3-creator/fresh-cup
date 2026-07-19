import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { MarketingAiService } from "../services/marketing-ai/marketing-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

@Injectable()
export class MarketingAgent implements DomainAgent {
  readonly key = "marketing";
  readonly name = "Marketing Agent";
  readonly domain = "marketing";
  readonly keywords = [
    "marketing",
    "campaign",
    "coupon",
    "promotion",
    "discount",
    "ads",
    "advertising",
    "target",
  ] as const;

  constructor(private readonly marketingAi: MarketingAiService) {}

  async answer(actor: RequestUser): Promise<AgentAnswer> {
    const [campaigns, coupons] = await Promise.all([
      this.marketingAi.campaignRecommendations(actor),
      this.marketingAi.couponOptimization(),
    ]);
    const insights = toInsightList(campaigns, coupons);
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
