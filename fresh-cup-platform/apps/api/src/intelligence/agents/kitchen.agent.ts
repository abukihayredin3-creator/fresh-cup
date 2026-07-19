import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { KitchenAiService } from "../services/kitchen-ai/kitchen-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

@Injectable()
export class KitchenAgent implements DomainAgent {
  readonly key = "kitchen";
  readonly name = "Kitchen Agent";
  readonly domain = "kitchen";
  readonly keywords = [
    "kitchen",
    "prep",
    "station",
    "bottleneck",
    "cook",
    "cooking",
    "efficiency",
  ] as const;

  constructor(private readonly kitchenAi: KitchenAiService) {}

  async answer(_actor: RequestUser, branchId: string | undefined): Promise<AgentAnswer> {
    const [bottlenecks, workload] = await Promise.all([
      this.kitchenAi.prepBottlenecks(branchId),
      this.kitchenAi.stationWorkload(branchId),
    ]);
    const insights = toInsightList(bottlenecks, workload);
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
