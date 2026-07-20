import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentOrganization } from "../tenancy/current-organization.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { BranchBenchmark, ExecutiveScorecard } from "./benchmarking.service";
import { BenchmarkingService } from "./benchmarking.service";
import type { ExportedFile } from "./bi-export.service";
import { BiExportService } from "./bi-export.service";
import { EnterpriseDateRangeDto } from "./dto/date-range.dto";
import type { AggregatedForecast } from "./forecast-aggregation.service";
import { ForecastAggregationService } from "./forecast-aggregation.service";
import type { BranchIdentity, RegionRollup, RollupResult } from "./enterprise-analytics.service";
import { EnterpriseAnalyticsService } from "./enterprise-analytics.service";

@ApiTags("enterprise-analytics")
@ApiBearerAuth()
@Controller("enterprise/analytics")
@UseGuards(TenantContextGuard)
export class EnterpriseAnalyticsController {
  constructor(
    private readonly analyticsService: EnterpriseAnalyticsService,
    private readonly benchmarkingService: BenchmarkingService,
    private readonly forecastAggregationService: ForecastAggregationService,
    private readonly biExportService: BiExportService,
  ) {}

  @Get("corporate-dashboard")
  @ApiOperation({ summary: "Org-wide revenue/order rollup across every branch" })
  corporateDashboard(
    @CurrentOrganization() organizationId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    return this.analyticsService.corporateDashboard(organizationId, dateRange);
  }

  @Get("franchises/:franchiseId")
  @ApiOperation({ summary: "Revenue/order rollup for one franchise's branches" })
  franchiseAnalytics(
    @CurrentOrganization() organizationId: string,
    @Param("franchiseId") franchiseId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    return this.analyticsService.franchiseAnalytics(organizationId, franchiseId, dateRange);
  }

  @Get("regions/:regionId")
  @ApiOperation({ summary: "Revenue/order rollup for one region's branches" })
  regionAnalytics(
    @CurrentOrganization() organizationId: string,
    @Param("regionId") regionId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    return this.analyticsService.regionAnalytics(organizationId, regionId, dateRange);
  }

  @Get("branch-groups/:branchGroupId")
  @ApiOperation({ summary: "Revenue/order rollup for one branch group's branches" })
  branchGroupAnalytics(
    @CurrentOrganization() organizationId: string,
    @Param("branchGroupId") branchGroupId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<RollupResult> {
    return this.analyticsService.branchGroupAnalytics(organizationId, branchGroupId, dateRange);
  }

  @Get("cross-region")
  @ApiOperation({ summary: "One rollup per region, plus an Unassigned bucket" })
  crossRegionAnalytics(
    @CurrentOrganization() organizationId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<RegionRollup[]> {
    return this.analyticsService.crossRegionAnalytics(organizationId, dateRange);
  }

  @Get("benchmark")
  @ApiOperation({ summary: "Rank branches by revenue against the org-wide average" })
  benchmarkBranches(
    @CurrentOrganization() organizationId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<BranchBenchmark[]> {
    return this.benchmarkingService.benchmarkBranches(organizationId, dateRange);
  }

  @Get("scorecard")
  @ApiOperation({ summary: "Single-page executive scorecard vs. the prior period" })
  executiveScorecard(
    @CurrentOrganization() organizationId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<ExecutiveScorecard> {
    return this.benchmarkingService.executiveScorecard(organizationId, dateRange);
  }

  @Get("forecast")
  @ApiOperation({ summary: "Org-wide aggregated revenue forecast (sum of per-branch predictions)" })
  aggregateForecast(@CurrentOrganization() organizationId: string): Promise<AggregatedForecast> {
    return this.forecastAggregationService.aggregateOrgRevenueForecast(organizationId);
  }

  @Get("branches")
  @ApiOperation({ summary: "List the organization's branches (for building scope pickers)" })
  listBranches(@CurrentOrganization() organizationId: string): Promise<BranchIdentity[]> {
    return this.analyticsService.listOrgBranches(organizationId);
  }

  @Get("exports/corporate-dashboard")
  @ApiOperation({ summary: "Export the corporate dashboard rollup as CSV" })
  exportCorporateDashboard(
    @CurrentOrganization() organizationId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<ExportedFile> {
    return this.biExportService.exportCorporateDashboardCsv(organizationId, dateRange);
  }

  @Get("exports/benchmark")
  @ApiOperation({ summary: "Export the branch benchmark as CSV" })
  exportBenchmark(
    @CurrentOrganization() organizationId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<ExportedFile> {
    return this.biExportService.exportBenchmarkCsv(organizationId, dateRange);
  }

  @Get("exports/scorecard")
  @ApiOperation({ summary: "Export the executive scorecard as CSV" })
  exportScorecard(
    @CurrentOrganization() organizationId: string,
    @Query() dateRange: EnterpriseDateRangeDto,
  ): Promise<ExportedFile> {
    return this.biExportService.exportExecutiveScorecardCsv(organizationId, dateRange);
  }
}
