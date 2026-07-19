import type { RequestUser } from "../../common/types/request-user.interface";
import type { AiInsightDto } from "../dto/ai-insight.dto";

export interface AgentAnswer {
  agentKey: string;
  agentName: string;
  domain: string;
  summary: string;
  /** 0-1, the average of every insight this agent's answer is built from. */
  confidence: number;
  insights: AiInsightDto[];
}

/**
 * One specialized agent — Sales/Marketing/Inventory/Kitchen/Delivery/
 * Finance/HR/Executive — each a thin wrapper around one (or two) existing
 * Part 1 domain AI services, not a new reasoning engine. The
 * `CoordinatorAgentService` is what makes this "multi-agent": it routes a
 * question to whichever agents look relevant by `keywords` and combines
 * their answers, rather than any single agent trying to cover everything.
 */
export interface DomainAgent {
  readonly key: string;
  readonly name: string;
  readonly domain: string;
  readonly keywords: readonly string[];
  answer(actor: RequestUser, branchId: string | undefined, question: string): Promise<AgentAnswer>;
}
