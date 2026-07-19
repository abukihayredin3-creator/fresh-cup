import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { DeliveryAgent } from "./delivery.agent";
import { ExecutiveAgent } from "./executive.agent";
import { FinanceAgent } from "./finance.agent";
import { HrAgent } from "./hr.agent";
import { InventoryAgent } from "./inventory.agent";
import { KitchenAgent } from "./kitchen.agent";
import { MarketingAgent } from "./marketing.agent";
import { SalesAgent } from "./sales.agent";
import type { AgentAnswer, DomainAgent } from "./agent.types";

export interface CoordinatorResult {
  question: string;
  routedAgents: string[];
  answers: AgentAnswer[];
  synthesis: string;
  confidence: number;
}

/**
 * The "Coordinator Agent" from Phase 11 Part 3's spec — combines the 8
 * specialized agents rather than being a 9th reasoning engine itself.
 * Routing is keyword-overlap scoring against each agent's declared
 * `keywords` (no LLM call required, so this works even with
 * LLM_PROVIDER=none); ties and no-match questions fall back to the
 * Executive Agent, since "how are we doing" is the most reasonable
 * default reading of an unrouted question. `synthesis` is a deterministic
 * template (numbered per-agent summaries) — no invented cross-agent
 * causality that the underlying insights don't actually support.
 */
@Injectable()
export class CoordinatorAgentService {
  private readonly agents: DomainAgent[];

  constructor(
    salesAgent: SalesAgent,
    marketingAgent: MarketingAgent,
    inventoryAgent: InventoryAgent,
    kitchenAgent: KitchenAgent,
    deliveryAgent: DeliveryAgent,
    financeAgent: FinanceAgent,
    hrAgent: HrAgent,
    executiveAgent: ExecutiveAgent,
  ) {
    this.agents = [
      salesAgent,
      marketingAgent,
      inventoryAgent,
      kitchenAgent,
      deliveryAgent,
      financeAgent,
      hrAgent,
      executiveAgent,
    ];
  }

  listAgents(): { key: string; name: string; domain: string; keywords: readonly string[] }[] {
    return this.agents.map((a) => ({
      key: a.key,
      name: a.name,
      domain: a.domain,
      keywords: a.keywords,
    }));
  }

  route(question: string): DomainAgent[] {
    const normalized = question.toLowerCase();
    const scored = this.agents
      .map((agent) => ({
        agent,
        score: agent.keywords.filter((keyword) => normalized.includes(keyword)).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return [this.agents.find((a) => a.key === "executive")!];
    }
    return scored.map((entry) => entry.agent);
  }

  async ask(actor: RequestUser, question: string, branchId?: string): Promise<CoordinatorResult> {
    const routed = this.route(question);
    const answers = await Promise.all(
      routed.map((agent) => agent.answer(actor, branchId, question)),
    );

    const synthesis = answers
      .map((answer, index) => `${index + 1}. [${answer.agentName}] ${answer.summary}`)
      .join("\n");

    const confidence =
      answers.length === 0 ? 0 : answers.reduce((sum, a) => sum + a.confidence, 0) / answers.length;

    return {
      question,
      routedAgents: routed.map((a) => a.key),
      answers,
      synthesis,
      confidence,
    };
  }
}
