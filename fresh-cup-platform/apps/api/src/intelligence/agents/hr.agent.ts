import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { WorkforceAiService } from "../services/workforce-ai/workforce-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

@Injectable()
export class HrAgent implements DomainAgent {
  readonly key = "hr";
  readonly name = "HR Agent";
  readonly domain = "workforce";
  readonly keywords = [
    "hr",
    "staff",
    "staffing",
    "schedule",
    "scheduling",
    "shift",
    "attendance",
    "employee",
    "labor",
  ] as const;

  constructor(private readonly workforceAi: WorkforceAiService) {}

  async answer(_actor: RequestUser, branchId: string | undefined): Promise<AgentAnswer> {
    const [scheduling, attendance] = await Promise.all([
      this.workforceAi.schedulingInsights(branchId),
      this.workforceAi.attendanceAnomalies(branchId),
    ]);
    const insights = toInsightList(scheduling, attendance);
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
