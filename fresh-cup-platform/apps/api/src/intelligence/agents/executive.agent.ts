import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ExecutiveAiService } from "../services/executive-ai/executive-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

@Injectable()
export class ExecutiveAgent implements DomainAgent {
  readonly key = "executive";
  readonly name = "Executive Agent";
  readonly domain = "executive";
  readonly keywords = [
    "overall",
    "business",
    "today",
    "summary",
    "how are we doing",
    "risk",
    "performance",
    "branch",
  ] as const;

  constructor(private readonly executiveAi: ExecutiveAiService) {}

  async answer(actor: RequestUser, branchId: string | undefined): Promise<AgentAnswer> {
    const [daily, risks] = await Promise.all([
      this.executiveAi.dailySummary(actor, branchId),
      this.executiveAi.riskDetection(actor, branchId),
    ]);
    const insights = toInsightList(daily, risks);
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
