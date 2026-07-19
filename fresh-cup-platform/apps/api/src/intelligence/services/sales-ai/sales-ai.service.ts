import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ForecastGranularity, ForecastMetric } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import { ForecastingService } from "../../../modules/intelligence/forecasting/forecasting.service";
import { RecommendationsService } from "../../../modules/intelligence/recommendations/recommendations.service";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { ExplanationService } from "../explanation.service";

function toBirr(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/**
 * Wraps Phase 6's ForecastingService (nightly-regenerated snapshots) and
 * RecommendationsService — Sales AI adds explanation/confidence framing on
 * top, it does not run its own forecasting model.
 */
@Injectable()
export class SalesAiService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly forecastingService: ForecastingService,
    private readonly recommendationsService: RecommendationsService,
    private readonly explanation: ExplanationService,
  ) {}

  private assertEnabled(): void {
    if (!this.config.get("AI_FORECASTING_ENABLED", { infer: true })) {
      throw new ForbiddenException(
        "Sales AI is disabled in this environment (AI_FORECASTING_ENABLED=false)",
      );
    }
  }

  async demandForecast(branchId?: string): Promise<AiInsightDto> {
    this.assertEnabled();
    const { modelVersion, points } = await this.forecastingService.series(
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.DAILY,
      branchId,
    );
    const future = points.filter((p) => p.targetPeriodStart > new Date());
    const dataPoints = {
      modelVersion,
      horizonDays: future.length,
      nextPeriodRevenueEtb: future[0] ? toBirr(Number(future[0].predictedValue)) : null,
      totalForecastedRevenueEtb: toBirr(
        future.reduce((sum, p) => sum + Number(p.predictedValue), 0),
      ),
    };
    return {
      title: "Sales demand forecast",
      explanation: await this.explanation.explain("Sales demand forecast", dataPoints),
      confidence: future[0] ? Number(future[0].confidence) : 0.1,
      data: { modelVersion, points: future },
    };
  }

  async peakHourPrediction(branchId?: string): Promise<AiInsightDto> {
    this.assertEnabled();
    const hours = await this.forecastingService.hourlyDemand(branchId);
    const top = [...hours].sort((a, b) => b.predictedOrders - a.predictedOrders)[0];
    const dataPoints = { peakHour: top?.hour ?? null, predictedOrders: top?.predictedOrders ?? 0 };
    return {
      title: "Peak-hour prediction",
      explanation: await this.explanation.explain("Peak-hour prediction", dataPoints),
      confidence: confidenceScore(hours.map((h) => h.predictedOrders)),
      data: hours,
    };
  }

  async averageTicketPrediction(branchId?: string): Promise<AiInsightDto> {
    this.assertEnabled();
    const [revenue, orders] = await Promise.all([
      this.forecastingService.series(
        ForecastMetric.SALES_REVENUE,
        ForecastGranularity.DAILY,
        branchId,
      ),
      this.forecastingService.series(
        ForecastMetric.SALES_ORDERS,
        ForecastGranularity.DAILY,
        branchId,
      ),
    ]);
    const now = new Date();
    const nextRevenue = revenue.points.find((p) => p.targetPeriodStart > now);
    const nextOrders = orders.points.find((p) => p.targetPeriodStart > now);
    const predictedOrders = nextOrders ? Number(nextOrders.predictedValue) : 0;
    const predictedAvgTicketEtb =
      nextRevenue && predictedOrders > 0
        ? toBirr(Number(nextRevenue.predictedValue)) / predictedOrders
        : null;
    const dataPoints = { predictedAvgTicketEtb, predictedOrders };
    return {
      title: "Average ticket prediction",
      explanation: await this.explanation.explain("Average ticket prediction", dataPoints),
      confidence: nextRevenue ? Number(nextRevenue.confidence) : 0.1,
      data: dataPoints,
    };
  }

  async bestSellerPrediction(branchId?: string): Promise<AiInsightDto> {
    this.assertEnabled();
    const products = await this.forecastingService.productDemand(branchId);
    const totals = products.map((p) => ({
      nameEn: p.nameEn,
      totalPredicted: p.points.reduce((sum, point) => sum + point.predictedValue, 0),
    }));
    const top = [...totals].sort((a, b) => b.totalPredicted - a.totalPredicted).slice(0, 5);
    const dataPoints = { topProducts: top };
    return {
      title: "Best-seller prediction",
      explanation: await this.explanation.explain("Best-seller prediction", dataPoints),
      confidence: confidenceScore(totals.map((p) => p.totalPredicted)),
      data: products,
    };
  }

  async crossSellOpportunities(menuItemId: string): Promise<AiInsightDto> {
    this.assertEnabled();
    const items = await this.recommendationsService.upsellCrossSell(menuItemId);
    const dataPoints = { candidateCount: items.length, topPick: items[0]?.nameEn ?? null };
    return {
      title: "Cross-sell opportunities",
      explanation: await this.explanation.explain("Cross-sell opportunities", dataPoints),
      confidence: confidenceScore(items.map((_, i) => items.length - i)),
      data: items,
    };
  }
}
