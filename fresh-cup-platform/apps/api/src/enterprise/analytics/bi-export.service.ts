import { Injectable } from "@nestjs/common";
import { BenchmarkingService } from "./benchmarking.service";
import type { EnterpriseDateRangeDto } from "./dto/date-range.dto";
import { EnterpriseAnalyticsService } from "./enterprise-analytics.service";

export interface ExportedFile {
  filename: string;
  mimeType: string;
  content: string;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Enterprise BI exports — same "hand-roll real artifacts, no PDF/XLSX
 * library" convention as `intelligence/copilot/copilot-export.util.ts`:
 * CSV opens directly in Excel/Sheets as a genuine spreadsheet, not a
 * fake binary format.
 */
@Injectable()
export class BiExportService {
  constructor(
    private readonly analyticsService: EnterpriseAnalyticsService,
    private readonly benchmarkingService: BenchmarkingService,
  ) {}

  async exportCorporateDashboardCsv(
    organizationId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<ExportedFile> {
    const rollup = await this.analyticsService.corporateDashboard(organizationId, dateRange);
    const rows: string[] = ["Branch,RevenueMinor,Orders,AverageOrderValueMinor"];
    for (const branch of rollup.byBranch) {
      rows.push(
        `${csvEscape(branch.name)},${branch.revenueMinor},${branch.orderCount},${branch.averageOrderValueMinor}`,
      );
    }
    rows.push(
      `TOTAL,${rollup.totalRevenueMinor},${rollup.totalOrders},${rollup.averageOrderValueMinor}`,
    );
    return {
      filename: `corporate-dashboard-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: "text/csv",
      content: rows.join("\n"),
    };
  }

  async exportBenchmarkCsv(
    organizationId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<ExportedFile> {
    const benchmarks = await this.benchmarkingService.benchmarkBranches(organizationId, dateRange);
    const rows: string[] = [
      "Rank,Branch,RevenueMinor,Orders,AverageOrderValueMinor,PercentVsAverage",
    ];
    for (const b of benchmarks) {
      rows.push(
        `${b.rank},${csvEscape(b.name)},${b.revenueMinor},${b.orderCount},${b.averageOrderValueMinor},${b.percentVsAverage}`,
      );
    }
    return {
      filename: `branch-benchmark-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: "text/csv",
      content: rows.join("\n"),
    };
  }

  async exportExecutiveScorecardCsv(
    organizationId: string,
    dateRange: EnterpriseDateRangeDto,
  ): Promise<ExportedFile> {
    const scorecard = await this.benchmarkingService.executiveScorecard(organizationId, dateRange);
    const rows: string[] = [
      "Metric,Value",
      `Branch Count,${scorecard.branchCount}`,
      `Total Revenue (minor units),${scorecard.totalRevenueMinor}`,
      `Total Orders,${scorecard.totalOrders}`,
      `Average Order Value (minor units),${scorecard.averageOrderValueMinor}`,
      `Previous Period Revenue (minor units),${scorecard.previousPeriodRevenueMinor}`,
      `Revenue Growth %,${scorecard.revenueGrowthPercent}`,
      `Top Branch,${csvEscape(scorecard.topBranch?.name ?? "N/A")}`,
      `Bottom Branch,${csvEscape(scorecard.bottomBranch?.name ?? "N/A")}`,
    ];
    return {
      filename: `executive-scorecard-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: "text/csv",
      content: rows.join("\n"),
    };
  }
}
