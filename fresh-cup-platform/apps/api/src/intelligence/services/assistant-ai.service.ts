import { Injectable } from "@nestjs/common";
import { AiMemoryKind } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AI_GUARDRAIL_PREAMBLE } from "../prompts/system-prompts";
import { AiMemoryService } from "../memory/ai-memory.service";
import { AgentRunnerService } from "./agent-runner.service";
import { CustomerAiService } from "./customer-ai/customer-ai.service";
import { ExecutiveAiService } from "./executive-ai/executive-ai.service";
import { InventoryAiService } from "./inventory-ai/inventory-ai.service";
import { SalesAiService } from "./sales-ai/sales-ai.service";
import type { AiToolRegistry } from "../tools/tool-registry.interface";

export interface AssistantAskResult {
  answer: string;
  toolCalls: { tool: string; input: Record<string, unknown>; result: unknown }[];
  usedLlm: boolean;
  memoryEntryId?: string;
}

/**
 * The Restaurant Intelligence Platform's cross-domain conversational
 * surface — routes a manager's free-text question through
 * AgentRunnerService (provider-agnostic: Anthropic/OpenAI/Azure/
 * OpenRouter/Ollama/Gemini, whichever LLM_PROVIDER selects) against tools
 * that delegate to the same domain AI services the dashboards use, so an
 * answer is never a bare LLM claim. Separate from Phase 6's
 * AiAssistantService (Claude-only, its own tool set) — this proves the
 * Phase 7 provider abstraction end to end without touching Phase 6.
 */
@Injectable()
export class AssistantAiService {
  constructor(
    private readonly agentRunner: AgentRunnerService,
    private readonly memory: AiMemoryService,
    private readonly executiveAi: ExecutiveAiService,
    private readonly customerAi: CustomerAiService,
    private readonly inventoryAi: InventoryAiService,
    private readonly salesAi: SalesAiService,
  ) {}

  private buildTools(): AiToolRegistry {
    return {
      get_daily_summary: {
        definition: {
          name: "get_daily_summary",
          description: "Today's revenue, profit, and order performance, explained.",
          inputSchema: { type: "object", properties: { branchId: { type: "string" } } },
        },
        run: (actor, input) =>
          this.executiveAi.dailySummary(actor, input.branchId as string | undefined),
      },
      get_churn_risk_customers: {
        definition: {
          name: "get_churn_risk_customers",
          description: "Customers with elevated churn risk, highest risk first.",
          inputSchema: { type: "object", properties: { branchId: { type: "string" } } },
        },
        run: (actor, input) =>
          this.customerAi.churnPrediction(actor, input.branchId as string | undefined),
      },
      get_reorder_suggestions: {
        definition: {
          name: "get_reorder_suggestions",
          description: "Inventory items that should be reordered soon.",
          inputSchema: { type: "object", properties: { branchId: { type: "string" } } },
        },
        run: (_actor, input) =>
          this.inventoryAi.restockingRecommendations(input.branchId as string | undefined),
      },
      get_sales_forecast: {
        definition: {
          name: "get_sales_forecast",
          description: "Predicted sales revenue over the forecast horizon.",
          inputSchema: { type: "object", properties: { branchId: { type: "string" } } },
        },
        run: (_actor, input) => this.salesAi.demandForecast(input.branchId as string | undefined),
      },
    };
  }

  async ask(actor: RequestUser, question: string, branchId?: string): Promise<AssistantAskResult> {
    const result = await this.agentRunner.run({
      system: `${AI_GUARDRAIL_PREAMBLE}\n\nYou can call tools covering executive, customer, inventory, and sales data.`,
      question,
      tools: this.buildTools(),
      actor,
      context: branchId ? { branchId } : {},
    });

    const answer =
      result.text ||
      (result.toolCalls.length > 0
        ? "Here's what I found — see the data below for details."
        : "Set LLM_PROVIDER to enable natural-language answers; the domain AI dashboards have this same data.");

    const memoryEntryId = await this.memory.remember({
      kind: AiMemoryKind.CONVERSATION,
      domain: "assistant",
      title: question.slice(0, 100),
      content: answer,
      metadata: { toolCalls: result.toolCalls },
      branchId,
      authorUserId: actor.id,
    });

    return {
      answer,
      toolCalls: result.toolCalls,
      usedLlm: result.usedLlm,
      memoryEntryId: memoryEntryId ?? undefined,
    };
  }
}
