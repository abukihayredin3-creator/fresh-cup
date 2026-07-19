import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiMemoryKind } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ExecutiveService } from "../../../modules/intelligence/executive/executive.service";
import { MarketingIntelligenceService } from "../../../modules/intelligence/marketing-intelligence/marketing-intelligence.service";
import { linearRegression } from "../../../modules/intelligence/ml/stats.util";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { AiMemoryService } from "../../memory/ai-memory.service";
import { ExplanationService } from "../explanation.service";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Wraps Phase 6's ExecutiveService (revenue trend, product profitability,
 * branch comparison, ...) rather than recomputing any of it — Executive AI
 * adds explanation + confidence + long-term memory on top of numbers that
 * already exist, per the "extend, don't duplicate" rule.
 */
@Injectable()
export class ExecutiveAiService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly executiveService: ExecutiveService,
    private readonly marketingIntelligence: MarketingIntelligenceService,
    private readonly memory: AiMemoryService,
    private readonly explanation: ExplanationService,
  ) {}

  private assertEnabled(): void {
    if (!this.config.get("AI_EXECUTIVE_ENABLED", { infer: true })) {
      throw new ForbiddenException(
        "Executive AI is disabled in this environment (AI_EXECUTIVE_ENABLED=false)",
      );
    }
  }

  async dailySummary(actor: RequestUser, branchId?: string): Promise<AiInsightDto> {
    return this.summaryFor(
      actor,
      branchId,
      isoDate(new Date()),
      isoDate(new Date()),
      "Daily summary",
    );
  }

  async weeklyReport(actor: RequestUser, branchId?: string): Promise<AiInsightDto> {
    const to = new Date();
    const from = new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);
    return this.summaryFor(actor, branchId, isoDate(from), isoDate(to), "Weekly report");
  }

  private async summaryFor(
    actor: RequestUser,
    branchId: string | undefined,
    from: string,
    to: string,
    title: string,
  ): Promise<AiInsightDto> {
    this.assertEnabled();
    const overview = await this.executiveService.overview(actor, { branchId, from, to });
    const dataPoints = {
      totalRevenueEtb: overview.totalRevenue / 100,
      totalEstimatedProfitEtb: overview.totalEstimatedProfit / 100,
      repeatCustomerRate: overview.repeatCustomerRate,
      ordersConverted: overview.conversionMetrics.ordersPlaced,
    };
    const explanation = await this.explanation.explain(title, dataPoints);
    const confidence = confidenceScore(overview.revenueTrend.map((p) => p.revenue));
    const memoryEntryId = await this.memory.remember({
      kind: AiMemoryKind.EXPLANATION,
      domain: "executive",
      title,
      content: explanation,
      metadata: dataPoints,
      branchId,
      authorUserId: actor.id,
    });

    return {
      title,
      explanation,
      confidence,
      data: overview,
      memoryEntryId: memoryEntryId ?? undefined,
    };
  }

  async revenueExplanation(actor: RequestUser, branchId?: string): Promise<AiInsightDto> {
    this.assertEnabled();
    const overview = await this.executiveService.overview(actor, { branchId });
    const values = overview.revenueTrend.map((p) => p.revenue);
    const { slope } = linearRegression(values);
    const direction = slope > 0 ? "rising" : slope < 0 ? "falling" : "flat";
    const dataPoints = {
      direction,
      totalRevenueEtb: overview.totalRevenue / 100,
      dailyTrendChangeEtb: Math.round(slope) / 100,
    };
    const explanation = await this.explanation.explain("Revenue trend explanation", dataPoints);
    return {
      title: "Revenue trend explanation",
      explanation,
      confidence: confidenceScore(values),
      data: overview,
    };
  }

  async riskDetection(actor: RequestUser, branchId?: string): Promise<AiInsightDto[]> {
    this.assertEnabled();
    const overview = await this.executiveService.overview(actor, { branchId });
    const insights: AiInsightDto[] = [];

    const revenueValues = overview.revenueTrend.map((p) => p.revenue);
    if (revenueValues.length >= 4) {
      const { slope } = linearRegression(revenueValues);
      if (slope < 0) {
        const dataPoints = { dailyTrendChangeEtb: Math.round(slope) / 100 };
        insights.push({
          title: "Revenue decline trend",
          explanation: await this.explanation.explain("Revenue decline trend", dataPoints),
          confidence: confidenceScore(revenueValues),
          data: dataPoints,
        });
      }
    }

    if (overview.inventoryCosts.purchasingSpend > 0) {
      const wasteRatio =
        overview.inventoryCosts.wasteCost / overview.inventoryCosts.purchasingSpend;
      if (wasteRatio > 0.05) {
        const dataPoints = { wasteRatioPercent: Math.round(wasteRatio * 1000) / 10 };
        insights.push({
          title: "Elevated inventory waste",
          explanation: await this.explanation.explain("Elevated inventory waste", dataPoints),
          confidence: confidenceScore(revenueValues),
          data: dataPoints,
        });
      }
    }

    if (overview.repeatCustomerRate < 0.2 && overview.conversionMetrics.ordersPlaced >= 10) {
      const dataPoints = { repeatCustomerRate: overview.repeatCustomerRate };
      insights.push({
        title: "Low repeat-customer rate",
        explanation: await this.explanation.explain("Low repeat-customer rate", dataPoints),
        confidence: confidenceScore(revenueValues),
        data: dataPoints,
      });
    }

    return insights;
  }

  async growthOpportunities(actor: RequestUser): Promise<AiInsightDto[]> {
    this.assertEnabled();
    const suggestions = await this.marketingIntelligence.targetSuggestions(actor);
    return Promise.all(
      suggestions.map(async (s) => ({
        title: `Growth opportunity: ${s.segment}`,
        explanation: await this.explanation.explain(`Growth opportunity: ${s.segment}`, {
          segment: s.segment,
          customerCount: s.customerCount,
          suggestion: s.suggestion,
        }),
        confidence: confidenceScore([s.customerCount]),
        data: s,
      })),
    );
  }
}
