import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { InventoryAiService } from "../services/inventory-ai/inventory-ai.service";
import { averageConfidence, summarizeInsights, toInsightList } from "./agent-helpers.util";
import type { AgentAnswer, DomainAgent } from "./agent.types";

@Injectable()
export class InventoryAgent implements DomainAgent {
  readonly key = "inventory";
  readonly name = "Inventory Agent";
  readonly domain = "inventory";
  readonly keywords = [
    "inventory",
    "stock",
    "restock",
    "reorder",
    "waste",
    "supplier",
    "ingredient",
    "stockout",
  ] as const;

  constructor(private readonly inventoryAi: InventoryAiService) {}

  async answer(
    _actor: RequestUser,
    branchId: string | undefined,
    _question?: string,
  ): Promise<AgentAnswer> {
    const [restocking, waste] = await Promise.all([
      this.inventoryAi.restockingRecommendations(branchId),
      this.inventoryAi.wastePrediction(branchId),
    ]);
    const insights = toInsightList(restocking, waste);
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
