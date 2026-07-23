import { Injectable } from "@nestjs/common";
import type { ExecutiveSummary, Prisma } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../../ai-brain/interfaces/ai-brain.interfaces";
import { DecisionEngineService } from "../../ai-brain/services/decision-engine.service";
import { ReasoningEngineService } from "../../ai-brain/services/reasoning-engine.service";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { AiCopilotScopeService } from "./ai-copilot-scope.service";
import { RecommendationPriorityService } from "./recommendation-priority.service";

export type SummaryPeriod = "day" | "week";

/** Below this magnitude an inventory-cost swing reads as normal noise, not worth a sentence. */
const INVENTORY_COST_NOTABLE_THRESHOLD_PCT = 5;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function describeChange(pct: number): string {
  if (pct >= 1) return "increased";
  if (pct <= -1) return "decreased";
  return "held steady";
}

function lowerFirst(text: string): string {
  return text.length > 0 ? text[0]!.toLowerCase() + text.slice(1) : text;
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0]!.toUpperCase() + text.slice(1) : text;
}

/**
 * Feature 6 — a short, human-readable executive summary built from
 * structured templates and business rules, never an LLM (per Phase 9's
 * "no fake AI" principle — a hand-written template over real numbers is
 * honest about what generated it; a model quietly paraphrasing the same
 * numbers is not, for a feature explicitly scoped to skip one). Every
 * sentence reuses an existing signal: revenue change from
 * ReasoningEngineService's sales trend, the demand sentence from the AI
 * Brain's own DEMAND_FORECAST decision, and the top action from
 * RecommendationPriorityService. Inventory cost change is the one new
 * computation — ExecutiveService.overview called over two windows, since
 * overview() only reports one window's inventory costs, not a trend.
 */
@Injectable()
export class ExecutiveSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AiCopilotScopeService,
    private readonly reasoning: ReasoningEngineService,
    private readonly executive: ExecutiveService,
    private readonly decision: DecisionEngineService,
    private readonly recommendationPriority: RecommendationPriorityService,
  ) {}

  async generateSummary(
    actor: RequestUser,
    organizationId: string,
    branchId?: string,
    period: SummaryPeriod = "week",
  ): Promise<ExecutiveSummary> {
    const branchIds = await this.scope.resolveBranches(actor, organizationId, branchId);
    const windowDays = period === "day" ? 1 : 7;

    const [salesInsights, inventoryCostChangePct, decisions, recommendations] = await Promise.all([
      Promise.all(branchIds.map((id) => this.reasoning.analyze(organizationId, "sales", id))),
      this.inventoryCostChangePct(actor, branchIds, windowDays),
      this.decision.decide(organizationId, branchId),
      this.recommendationPriority.rank(actor, organizationId, branchId),
    ]);

    const revenueChangePct = average(
      salesInsights.map((insight) => {
        const content = insight.content as unknown as ReasoningResult;
        return content.signals.kind === "sales" ? content.signals.trend.revenueChangePct : 0;
      }),
    );
    const demandDecision = decisions.find((d) => d.decisionType === "DEMAND_FORECAST") ?? null;
    const topRecommendation = recommendations[0] ?? null;

    const content = this.buildSummary(
      period,
      revenueChangePct,
      inventoryCostChangePct,
      demandDecision,
      topRecommendation,
    );

    const keyMetrics = {
      revenueChangePct: Math.round(revenueChangePct * 10) / 10,
      inventoryCostChangePct: Math.round(inventoryCostChangePct * 10) / 10,
      demandSignal: demandDecision ? (demandDecision.output as { reason: string }).reason : null,
      topRecommendation: topRecommendation?.title ?? null,
    };

    return this.prisma.executiveSummary.create({
      data: {
        organizationId,
        branchId: branchId ?? undefined,
        period,
        content,
        keyMetrics: keyMetrics as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async inventoryCostChangePct(
    actor: RequestUser,
    branchIds: string[],
    windowDays: number,
  ): Promise<number> {
    if (branchIds.length === 0) {
      return 0;
    }
    const end = new Date();
    const currentStart = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const previousStart = new Date(end.getTime() - 2 * windowDays * 24 * 60 * 60 * 1000);

    // Full ISO timestamps, not date-only strings — a date-only `to` parses to that
    // day's UTC midnight and would silently exclude everything from earlier that day.
    const [current, previous] = await Promise.all([
      Promise.all(
        branchIds.map((id) =>
          this.executive.overview(actor, {
            branchId: id,
            from: currentStart.toISOString(),
            to: end.toISOString(),
          }),
        ),
      ),
      Promise.all(
        branchIds.map((id) =>
          this.executive.overview(actor, {
            branchId: id,
            from: previousStart.toISOString(),
            to: currentStart.toISOString(),
          }),
        ),
      ),
    ]);

    const totalCost = (overviews: typeof current) =>
      overviews.reduce(
        (sum, o) => sum + o.inventoryCosts.purchasingSpend + o.inventoryCosts.wasteCost,
        0,
      );
    const currentCost = totalCost(current);
    const previousCost = totalCost(previous);

    if (previousCost === 0) {
      return currentCost > 0 ? 100 : 0;
    }
    return ((currentCost - previousCost) / previousCost) * 100;
  }

  private buildSummary(
    period: SummaryPeriod,
    revenueChangePct: number,
    inventoryCostChangePct: number,
    demandDecision: { output: unknown } | null,
    topRecommendation: { title: string } | null,
  ): string {
    const sentences: string[] = [];
    const periodLabel = period === "day" ? "Today" : "This week";

    sentences.push(
      `${periodLabel} revenue ${describeChange(revenueChangePct)} by ${Math.abs(revenueChangePct).toFixed(0)}%.`,
    );

    if (Math.abs(inventoryCostChangePct) >= INVENTORY_COST_NOTABLE_THRESHOLD_PCT) {
      sentences.push(
        `Inventory costs ${inventoryCostChangePct >= 0 ? "rose" : "fell"} by ${Math.abs(inventoryCostChangePct).toFixed(0)}%.`,
      );
    }

    if (demandDecision) {
      const { reason } = demandDecision.output as { reason: string };
      sentences.push(`${capitalize(reason)}.`);
    }

    if (topRecommendation) {
      sentences.push(`The most important action is to ${lowerFirst(topRecommendation.title)}.`);
    }

    return sentences.join(" ");
  }
}
