import { Injectable } from "@nestjs/common";
import type { BranchRevenueMetric } from "./enterprise-analytics.service";
import { EnterpriseAnalyticsService } from "./enterprise-analytics.service";
import type { EnterpriseDateRangeDto } from "./dto/date-range.dto";

export interface BranchBenchmark extends BranchRevenueMetric {
  rank: number;
  percentVsAverage: number;
}

export interface ExecutiveScorecard {
  branchCount: number;
  totalRevenueMinor: number;
  totalOrders: number;
  averageOrderValueMinor: number;
  previousPeriodRevenueMinor: number;
  revenueGrowthPercent: number;
  topBranch: BranchRevenueMetric | null;
  bottomBranch: BranchRevenueMetric | null;
}

/**
 * Benchmarks branches against the organization-wide average and produces
 * a single-page executive scorecard (current vs. the immediately prior
 * period of equal length). Built entirely on top of
 * `EnterpriseAnalyticsService`'s rollups — no separate query path.
 */
@Injectable()
export class BenchmarkingService {
  constructor(private readonly analyticsService: EnterpriseAnalyticsService) {}

  async benchmarkBranches(
    organizationId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<BranchBenchmark[]> {
    const rollup = await this.analyticsService.corporateDashboard(organizationId, dateRange);
    const averageRevenueMinor =
      rollup.branchCount > 0 ? rollup.totalRevenueMinor / rollup.branchCount : 0;

    const sorted = [...rollup.byBranch].sort((a, b) => b.revenueMinor - a.revenueMinor);
    return sorted.map((branch, index) => ({
      ...branch,
      rank: index + 1,
      percentVsAverage:
        averageRevenueMinor > 0
          ? Math.round(((branch.revenueMinor - averageRevenueMinor) / averageRevenueMinor) * 1000) /
            10
          : 0,
    }));
  }

  async executiveScorecard(
    organizationId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<ExecutiveScorecard> {
    const to = dateRange.to ? new Date(dateRange.to) : new Date();
    const from = dateRange.from
      ? new Date(dateRange.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const windowMs = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - windowMs);

    const [current, previous] = await Promise.all([
      this.analyticsService.corporateDashboard(organizationId, {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
      this.analyticsService.corporateDashboard(organizationId, {
        from: previousFrom.toISOString(),
        to: previousTo.toISOString(),
      }),
    ]);

    const revenueGrowthPercent =
      previous.totalRevenueMinor > 0
        ? Math.round(
            ((current.totalRevenueMinor - previous.totalRevenueMinor) /
              previous.totalRevenueMinor) *
              1000,
          ) / 10
        : 0;

    const sortedByRevenue = [...current.byBranch].sort((a, b) => b.revenueMinor - a.revenueMinor);

    return {
      branchCount: current.branchCount,
      totalRevenueMinor: current.totalRevenueMinor,
      totalOrders: current.totalOrders,
      averageOrderValueMinor: current.averageOrderValueMinor,
      previousPeriodRevenueMinor: previous.totalRevenueMinor,
      revenueGrowthPercent,
      topBranch: sortedByRevenue[0] ?? null,
      bottomBranch: sortedByRevenue[sortedByRevenue.length - 1] ?? null,
    };
  }
}
