import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { AiQueryOutcome, ForecastGranularity, ForecastMetric, type Prisma } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import { AnalyticsService } from "../../analytics/analytics.service";
import { CustomerIntelligenceService } from "../customer-intelligence/customer-intelligence.service";
import { ExecutiveService } from "../executive/executive.service";
import { ForecastingService } from "../forecasting/forecasting.service";
import { InventoryIntelligenceService } from "../inventory-intelligence/inventory-intelligence.service";
import type {
  AiAssistantResponseDto,
  AiAssistantToolCallDto,
} from "./dto/ai-assistant-response.dto";

const MODEL = "claude-opus-4-8";
const MAX_TOOL_ITERATIONS = 4;

function toBirr(minorUnits: number): number {
  return Math.round((minorUnits / 100) * 100) / 100;
}

const SYSTEM_PROMPT = `You are the Fresh Cup Juice House operations assistant, built into the admin dashboard.
Answer questions about sales, inventory, customers, and forecasts using ONLY the data returned by
your tools — never estimate or invent a figure. If a tool returns no data, say so plainly instead
of guessing. Currency figures from tools are already in ETB (Ethiopian Birr), not minor units.
Keep answers short (2-4 sentences), reference the specific numbers you found, and suggest one
concrete next action when relevant (e.g. "reorder X" or "target segment Y"). You're talking to a
restaurant manager or owner, not a developer.`;

interface ToolExecutor {
  definition: Anthropic.Tool;
  run: (actor: RequestUser, input: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Two operating modes, same pattern as ChapaPaymentProvider's sandbox
 * fallback: with ANTHROPIC_API_KEY configured, Claude routes the question
 * to real intelligence-service tool calls and phrases the answer from
 * their output. Without a key (local dev/CI by default), a deterministic
 * keyword router picks the same tools directly — no LLM involved, but the
 * data and the "never fabricate" guarantee are identical either way.
 */
@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly client: Anthropic | null;
  private readonly tools: Record<string, ToolExecutor>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly analyticsService: AnalyticsService,
    private readonly customerIntelligence: CustomerIntelligenceService,
    private readonly inventoryIntelligence: InventoryIntelligenceService,
    private readonly forecastingService: ForecastingService,
    private readonly executiveService: ExecutiveService,
  ) {
    const apiKey = this.config.get("ANTHROPIC_API_KEY", { infer: true });
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.tools = this.buildTools();
  }

  async ask(
    actor: RequestUser,
    question: string,
    branchId?: string,
  ): Promise<AiAssistantResponseDto> {
    try {
      const result = this.client
        ? await this.askViaClaude(actor, question, branchId)
        : await this.askViaTemplate(actor, question, branchId);

      await this.prisma.aiAssistantQuery.create({
        data: {
          askedByUserId: actor.id,
          question,
          answer: result.answer,
          toolCalls: result.toolCalls as unknown as Prisma.InputJsonValue,
          outcome: result.outcome as AiQueryOutcome,
        },
      });
      return result;
    } catch (error) {
      this.logger.error("AI assistant query failed", error instanceof Error ? error.stack : error);
      const fallback = await this.askViaTemplate(actor, question, branchId);
      await this.prisma.aiAssistantQuery.create({
        data: {
          askedByUserId: actor.id,
          question,
          answer: fallback.answer,
          toolCalls: fallback.toolCalls as unknown as Prisma.InputJsonValue,
          outcome: AiQueryOutcome.ERROR,
        },
      });
      return { ...fallback, outcome: "ERROR" };
    }
  }

  private async askViaClaude(
    actor: RequestUser,
    question: string,
    branchId?: string,
  ): Promise<AiAssistantResponseDto> {
    const client = this.client!;
    const toolDefinitions = Object.values(this.tools).map((t) => t.definition);
    const toolCalls: AiAssistantToolCallDto[] = [];

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: branchId
          ? `${question}\n\n(Scope this to branchId=${branchId} where relevant.)`
          : question,
      },
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        tools: toolDefinitions,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
        return {
          answer: text?.text ?? "I couldn't find an answer to that.",
          outcome: "ANSWERED",
          toolCalls,
        };
      }

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        const executor = this.tools[block.name];
        const input = (block.input ?? {}) as Record<string, unknown>;
        const result = executor
          ? await executor.run(actor, { ...input, branchId: input.branchId ?? branchId })
          : { error: `Unknown tool ${block.name}` };
        toolCalls.push({ tool: block.name, input, result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    return {
      answer:
        "I gathered some data but couldn't finish reasoning about it in time — try a narrower question.",
      outcome: "ANSWERED",
      toolCalls,
    };
  }

  /** No API key configured — route by keyword to the same tools Claude would use, then phrase a template answer. */
  private async askViaTemplate(
    actor: RequestUser,
    question: string,
    branchId?: string,
  ): Promise<AiAssistantResponseDto> {
    const q = question.toLowerCase();
    const toolCalls: AiAssistantToolCallDto[] = [];
    const call = async (name: string, input: Record<string, unknown> = {}) => {
      const result = await this.tools[name]!.run(actor, { ...input, branchId });
      toolCalls.push({ tool: name, input, result });
      return result;
    };

    if (/reorder|restock|running (low|out)|shortage/.test(q)) {
      const items = (await call("get_reorder_suggestions")) as {
        name: string;
        suggestedReorderQuantity: number;
      }[];
      const answer =
        items.length === 0
          ? "Nothing needs reordering right now — all tracked ingredients are above their target coverage."
          : `${items.length} item(s) need reordering: ${items
              .slice(0, 5)
              .map((i) => `${i.name} (${i.suggestedReorderQuantity})`)
              .join(", ")}.`;
      return { answer, outcome: "FALLBACK", toolCalls };
    }

    if (/churn|at risk|losing customers|about to leave/.test(q)) {
      const customers = (await call("get_churn_risk_customers")) as {
        fullName: string;
        churnRisk: number;
      }[];
      const answer =
        customers.length === 0
          ? "No customers currently look at-risk of churning."
          : `${customers.length} customer(s) show elevated churn risk, highest: ${customers[0]!.fullName} (${Math.round(customers[0]!.churnRisk * 100)}% risk).`;
      return { answer, outcome: "FALLBACK", toolCalls };
    }

    if (/busiest|peak hour|busy time/.test(q)) {
      const hours = (await call("get_peak_hours")) as { hour: number; orderCount: number }[];
      const top = [...hours].sort((a, b) => b.orderCount - a.orderCount)[0];
      const answer = top
        ? `Your busiest hour is ${top.hour}:00 with ${top.orderCount} orders in the selected range.`
        : "Not enough order history yet to identify peak hours.";
      return { answer, outcome: "FALLBACK", toolCalls };
    }

    if (/underperform|worst.?selling|slow.?moving/.test(q)) {
      const items = (await call("get_underperforming_products")) as {
        nameEn: string;
        estimatedMargin: number;
      }[];
      const answer =
        items.length === 0
          ? "Not enough sales data yet to rank product performance."
          : `Lowest-margin products: ${items
              .slice(0, 5)
              .map((i) => i.nameEn)
              .join(", ")}.`;
      return { answer, outcome: "FALLBACK", toolCalls };
    }

    if (/forecast|predict/.test(q)) {
      const points = (await call("get_sales_forecast")) as {
        targetPeriodStart: string;
        predictedValue: number;
      }[];
      const answer =
        points.length === 0
          ? "No forecast is available yet — it regenerates nightly, or an admin can trigger it manually."
          : `Next-day forecasted revenue: ETB ${toBirr(points[0]!.predictedValue)}, over the next ${points.length} days totaling roughly ETB ${toBirr(points.reduce((s, p) => s + p.predictedValue, 0))}.`;
      return { answer, outcome: "FALLBACK", toolCalls };
    }

    // Default: sales summary — covers "how were sales today/yesterday" and anything unmatched.
    const summary = (await call("get_sales_summary")) as {
      totalRevenue: number;
      totalOrders: number;
      averageOrderValue: number;
    };
    const answer = `Revenue: ETB ${toBirr(summary.totalRevenue)} across ${summary.totalOrders} order(s), averaging ETB ${toBirr(summary.averageOrderValue)} per order.`;
    return { answer, outcome: "FALLBACK", toolCalls };
  }

  private buildTools(): Record<string, ToolExecutor> {
    const branchProp = {
      branchId: { type: "string", description: "Optional branch UUID to scope to" },
    };

    return {
      get_sales_summary: {
        definition: {
          name: "get_sales_summary",
          description:
            "Revenue, order count, and average order value over a date range (defaults to last 30 days).",
          input_schema: {
            type: "object",
            properties: { ...branchProp, from: { type: "string" }, to: { type: "string" } },
          },
        },
        run: async (actor, input) => {
          const sales = await this.analyticsService.sales(actor, {
            branchId: input.branchId as string | undefined,
            from: input.from as string | undefined,
            to: input.to as string | undefined,
          });
          return {
            from: sales.from,
            to: sales.to,
            totalRevenue: sales.totalRevenue,
            totalOrders: sales.totalOrders,
            averageOrderValue: sales.averageOrderValue,
          };
        },
      },
      get_underperforming_products: {
        definition: {
          name: "get_underperforming_products",
          description: "Menu items with the lowest estimated profit margin over the last 30 days.",
          input_schema: { type: "object", properties: branchProp },
        },
        run: async (actor, input) => {
          const overview = await this.executiveService.overview(actor, {
            branchId: input.branchId as string | undefined,
          });
          return overview.productProfitability
            .slice()
            .sort((a, b) => a.estimatedMargin - b.estimatedMargin)
            .slice(0, 5)
            .map((p) => ({
              nameEn: p.nameEn,
              revenue: toBirr(p.revenue),
              estimatedMargin: toBirr(p.estimatedMargin),
            }));
        },
      },
      get_reorder_suggestions: {
        definition: {
          name: "get_reorder_suggestions",
          description: "Inventory items that should be reordered soon, with a suggested quantity.",
          input_schema: { type: "object", properties: branchProp },
        },
        run: async (_actor, input) => {
          const items = await this.inventoryIntelligence.intelligence(
            input.branchId as string | undefined,
          );
          return items
            .filter((i) => i.suggestedReorderQuantity > 0)
            .map((i) => ({
              name: i.name,
              currentStock: i.currentStock,
              suggestedReorderQuantity: i.suggestedReorderQuantity,
              daysUntilStockout: i.daysUntilStockout,
            }));
        },
      },
      get_peak_hours: {
        definition: {
          name: "get_peak_hours",
          description: "Actual order count by hour-of-day over the last 30 days.",
          input_schema: { type: "object", properties: branchProp },
        },
        run: async (actor, input) => {
          const overview = await this.executiveService.overview(actor, {
            branchId: input.branchId as string | undefined,
          });
          return overview.peakHours;
        },
      },
      get_churn_risk_customers: {
        definition: {
          name: "get_churn_risk_customers",
          description:
            "Customers with elevated churn risk (RFM 'At Risk' or 'Lost' segments), highest risk first.",
          input_schema: { type: "object", properties: branchProp },
        },
        run: async (actor, input) => {
          const customers = await this.customerIntelligence.segments(actor, {
            branchId: input.branchId as string | undefined,
            limit: 100,
          });
          return customers
            .filter((c) => c.segment === "At Risk" || c.segment === "Lost")
            .sort((a, b) => b.churnRisk - a.churnRisk)
            .slice(0, 10)
            .map((c) => ({
              fullName: c.fullName,
              churnRisk: c.churnRisk,
              segment: c.segment,
              totalSpend: toBirr(c.totalSpend),
            }));
        },
      },
      get_sales_forecast: {
        definition: {
          name: "get_sales_forecast",
          description: "Predicted daily revenue for the upcoming forecast horizon.",
          input_schema: { type: "object", properties: branchProp },
        },
        run: async (_actor, input) => {
          const { points } = await this.forecastingService.series(
            ForecastMetric.SALES_REVENUE,
            ForecastGranularity.DAILY,
            input.branchId as string | undefined,
          );
          return points
            .filter((p) => p.targetPeriodStart > new Date())
            .map((p) => ({
              targetPeriodStart: p.targetPeriodStart.toISOString(),
              predictedValue: Number(p.predictedValue),
              confidence: Number(p.confidence),
            }));
        },
      },
    };
  }
}
