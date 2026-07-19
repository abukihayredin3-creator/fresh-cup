import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { DeliveryAiService } from "../services/delivery-ai/delivery-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

@Injectable()
export class DeliveryAgent implements DomainAgent {
  readonly key = "delivery";
  readonly name = "Delivery Agent";
  readonly domain = "delivery";
  readonly keywords = ["delivery", "driver", "eta", "delay", "zone", "rider", "dispatch"] as const;

  constructor(private readonly deliveryAi: DeliveryAiService) {}

  async answer(_actor: RequestUser, branchId: string | undefined): Promise<AgentAnswer> {
    const [delays, zones] = await Promise.all([
      this.deliveryAi.delayDetection(branchId),
      this.deliveryAi.zoneOptimization(branchId),
    ]);
    const insights = toInsightList(delays, zones);
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
