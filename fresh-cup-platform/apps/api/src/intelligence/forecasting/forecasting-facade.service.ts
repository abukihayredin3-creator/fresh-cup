import { Injectable } from "@nestjs/common";
import { ForecastGranularity, ForecastMetric } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ForecastingService } from "../../modules/intelligence/forecasting/forecasting.service";
import { SalesAiService } from "../services/sales-ai/sales-ai.service";
import { ConfidenceCalibratorService } from "../calibration/confidence-calibrator.service";
import { linearRegression } from "../../modules/intelligence/ml/stats.util";
import { ModelRegistryV2Service } from "../registry/model-registry-v2.service";
import type { FeatureContribution } from "../models/feature-scoring.util";
import type { PredictionResultDto } from "../prediction/dto/prediction-result.dto";

function toBirr(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/**
 * Wraps Phase 6's `ForecastingService` (and Phase 11 Part 1's
 * `SalesAiService`) into the uniform `PredictionResultDto` shape this
 * phase's spec requires — never recomputes a forecast, only reframes an
 * existing one with contributing factors, a calibrated confidence, and a
 * recommended action. `categoryTrends` is the one genuinely new
 * capability here, grouping Phase 6's per-product demand forecast by
 * menu category (a view Phase 6 never exposed).
 */
@Injectable()
export class ForecastingFacadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastingService: ForecastingService,
    private readonly salesAi: SalesAiService,
    private readonly calibrator: ConfidenceCalibratorService,
    private readonly registry: ModelRegistryV2Service,
  ) {}

  private async modelVersionFor(modelKey: string): Promise<number> {
    const latest = await this.registry.latestRun(modelKey);
    return latest?.version ?? 1;
  }

  private async fromSeries(
    modelKey: string,
    metric: ForecastMetric,
    granularity: ForecastGranularity,
    branchId?: string,
  ): Promise<PredictionResultDto> {
    const { points } = await this.forecastingService.series(metric, granularity, branchId);
    const future = points.filter((p) => p.targetPeriodStart > new Date());
    const next = future[0];
    const recentActuals = points
      .filter((p) => p.actualValue !== null)
      .slice(-14)
      .map((p) => Number(p.actualValue));
    const { slope } = linearRegression(recentActuals.length >= 2 ? recentActuals : [0, 0]);

    const contributingFactors: FeatureContribution[] = [
      {
        feature: "recentTrend",
        value: Math.round(slope * 100) / 100,
        weight: 1,
        contribution: slope,
        direction: slope >= 0 ? "positive" : "negative",
      },
    ];

    return {
      modelKey,
      modelVersion: await this.modelVersionFor(modelKey),
      prediction: next ? toBirr(Number(next.predictedValue)) : 0,
      confidence: this.calibrator.normalize(next ? Number(next.confidence) : 0.1),
      topReasons: [
        slope >= 0 ? "Recent actuals trending upward" : "Recent actuals trending downward",
      ],
      contributingFactors,
      suggestedAction: next
        ? "Use this figure to plan staffing and inventory for the next period."
        : "No forecast available yet — it regenerates nightly, or an admin can trigger it manually.",
    };
  }

  hourlySales(branchId?: string): Promise<PredictionResultDto> {
    return this.fromSeries(
      "sales-hourly",
      ForecastMetric.HOURLY_DEMAND,
      ForecastGranularity.HOURLY,
      branchId,
    );
  }

  dailySales(branchId?: string): Promise<PredictionResultDto> {
    return this.fromSeries(
      "sales-daily",
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.DAILY,
      branchId,
    );
  }

  weeklySales(branchId?: string): Promise<PredictionResultDto> {
    return this.fromSeries(
      "sales-weekly",
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.WEEKLY,
      branchId,
    );
  }

  monthlySales(branchId?: string): Promise<PredictionResultDto> {
    return this.fromSeries(
      "sales-monthly",
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.MONTHLY,
      branchId,
    );
  }

  revenue(branchId?: string): Promise<PredictionResultDto> {
    return this.fromSeries(
      "sales-revenue",
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.DAILY,
      branchId,
    );
  }

  transactions(branchId?: string): Promise<PredictionResultDto> {
    return this.fromSeries(
      "sales-transactions",
      ForecastMetric.SALES_ORDERS,
      ForecastGranularity.DAILY,
      branchId,
    );
  }

  async averageTicket(branchId?: string): Promise<PredictionResultDto> {
    const insight = await this.salesAi.averageTicketPrediction(branchId);
    const data = insight.data as { predictedAvgTicketEtb: number | null };
    return {
      modelKey: "sales-average-ticket",
      modelVersion: await this.modelVersionFor("sales-average-ticket"),
      prediction: data.predictedAvgTicketEtb ?? 0,
      confidence: this.calibrator.normalize(insight.confidence),
      topReasons: [insight.explanation],
      contributingFactors: [],
      suggestedAction: "Use to set an upsell target for the next forecast period.",
    };
  }

  async bestSellers(
    branchId?: string,
  ): Promise<PredictionResultDto<{ nameEn: string; totalPredicted: number }[]>> {
    const insight = await this.salesAi.bestSellerPrediction(branchId);
    const data = insight.data as { topProducts: { nameEn: string; totalPredicted: number }[] };
    return {
      modelKey: "sales-best-sellers",
      modelVersion: await this.modelVersionFor("sales-best-sellers"),
      prediction: data.topProducts ?? [],
      confidence: this.calibrator.normalize(insight.confidence),
      topReasons: [insight.explanation],
      contributingFactors: [],
      suggestedAction:
        "Ensure top predicted sellers are well-stocked ahead of the forecast horizon.",
    };
  }

  /** Net-new — Phase 6 never grouped its per-product demand forecast by category. */
  async categoryTrends(
    branchId?: string,
  ): Promise<
    PredictionResultDto<
      { category: string; totalPredicted: number; trend: "rising" | "falling" | "flat" }[]
    >
  > {
    const products = await this.forecastingService.productDemand(branchId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: products.map((p) => p.menuItemId) } },
      select: { id: true, categoryId: true, category: { select: { nameEn: true } } },
    });
    const categoryById = new Map(menuItems.map((m) => [m.id, m.category.nameEn]));

    const byCategory = new Map<string, number[]>();
    for (const product of products) {
      const category = categoryById.get(product.menuItemId) ?? "Uncategorized";
      const series = byCategory.get(category) ?? [];
      product.points.forEach((point, i) => {
        series[i] = (series[i] ?? 0) + point.predictedValue;
      });
      byCategory.set(category, series);
    }

    const trends = Array.from(byCategory.entries()).map(([category, series]) => {
      const { slope } = linearRegression(series);
      return {
        category,
        totalPredicted: Math.round(series.reduce((sum, v) => sum + v, 0)),
        trend: (slope > 0.5 ? "rising" : slope < -0.5 ? "falling" : "flat") as
          "rising" | "falling" | "flat",
      };
    });
    trends.sort((a, b) => b.totalPredicted - a.totalPredicted);

    return {
      modelKey: "sales-category-trends",
      modelVersion: await this.modelVersionFor("sales-category-trends"),
      prediction: trends,
      confidence: this.calibrator.normalize(products.length >= 3 ? 0.6 : 0.3),
      topReasons: trends
        .slice(0, 3)
        .map((t) => `${t.category} is ${t.trend} (${t.totalPredicted} predicted units)`),
      contributingFactors: [],
      suggestedAction: "Adjust purchasing and menu promotion toward rising categories.",
    };
  }
}
