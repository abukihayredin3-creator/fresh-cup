import { Injectable } from "@nestjs/common";
import { ForecastingFacadeService } from "../../intelligence/forecasting/forecasting-facade.service";
import { EnterpriseAnalyticsService } from "./enterprise-analytics.service";

export interface BranchForecast {
  branchId: string;
  branchName: string;
  predictedRevenueMinor: number;
  confidence: number;
}

export interface AggregatedForecast {
  branchCount: number;
  totalPredictedRevenueMinor: number;
  averageConfidence: number;
  byBranch: BranchForecast[];
}

/**
 * Sums Phase 11's per-branch `ForecastingFacadeService.revenue()`
 * prediction across a set of branches — never recomputes a forecast,
 * only aggregates existing per-branch predictions the way
 * `EnterpriseAnalyticsService` aggregates existing per-branch actuals.
 * Confidence is averaged (not summed) since it's a 0-1 calibrated score,
 * not an additive quantity.
 */
@Injectable()
export class ForecastAggregationService {
  constructor(
    private readonly analyticsService: EnterpriseAnalyticsService,
    private readonly forecastingFacade: ForecastingFacadeService,
  ) {}

  async aggregateOrgRevenueForecast(organizationId: string): Promise<AggregatedForecast> {
    const branches = await this.analyticsService.listOrgBranches(organizationId);
    return this.aggregate(branches);
  }

  async aggregateBranchesRevenueForecast(
    branches: { id: string; name: string }[],
  ): Promise<AggregatedForecast> {
    return this.aggregate(branches);
  }

  private async aggregate(branches: { id: string; name: string }[]): Promise<AggregatedForecast> {
    if (branches.length === 0) {
      return { branchCount: 0, totalPredictedRevenueMinor: 0, averageConfidence: 0, byBranch: [] };
    }

    const byBranch: BranchForecast[] = await Promise.all(
      branches.map(async (branch) => {
        const forecast = await this.forecastingFacade.revenue(branch.id);
        return {
          branchId: branch.id,
          branchName: branch.name,
          predictedRevenueMinor: Math.round(forecast.prediction * 100),
          confidence: forecast.confidence,
        };
      }),
    );

    const totalPredictedRevenueMinor = byBranch.reduce(
      (sum, b) => sum + b.predictedRevenueMinor,
      0,
    );
    const averageConfidence = byBranch.reduce((sum, b) => sum + b.confidence, 0) / byBranch.length;

    return {
      branchCount: branches.length,
      totalPredictedRevenueMinor,
      averageConfidence: Math.round(averageConfidence * 1000) / 1000,
      byBranch,
    };
  }
}
