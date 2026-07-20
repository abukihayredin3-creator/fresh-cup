import { BiExportService } from "./bi-export.service";
import type { BenchmarkingService } from "./benchmarking.service";
import type { EnterpriseAnalyticsService } from "./enterprise-analytics.service";

describe("BiExportService", () => {
  function makeService() {
    const analyticsService = {
      corporateDashboard: jest.fn().mockResolvedValue({
        branchCount: 1,
        totalRevenueMinor: 10000,
        totalOrders: 4,
        averageOrderValueMinor: 2500,
        byBranch: [
          {
            id: "b1",
            name: "Branch, One",
            revenueMinor: 10000,
            orderCount: 4,
            averageOrderValueMinor: 2500,
          },
        ],
      }),
    } as unknown as jest.Mocked<EnterpriseAnalyticsService>;
    const benchmarkingService = {
      benchmarkBranches: jest
        .fn()
        .mockResolvedValue([
          {
            id: "b1",
            name: "Branch 1",
            revenueMinor: 10000,
            orderCount: 4,
            averageOrderValueMinor: 2500,
            rank: 1,
            percentVsAverage: 0,
          },
        ]),
      executiveScorecard: jest.fn().mockResolvedValue({
        branchCount: 1,
        totalRevenueMinor: 10000,
        totalOrders: 4,
        averageOrderValueMinor: 2500,
        previousPeriodRevenueMinor: 5000,
        revenueGrowthPercent: 100,
        topBranch: {
          id: "b1",
          name: "Branch 1",
          revenueMinor: 10000,
          orderCount: 4,
          averageOrderValueMinor: 2500,
        },
        bottomBranch: {
          id: "b1",
          name: "Branch 1",
          revenueMinor: 10000,
          orderCount: 4,
          averageOrderValueMinor: 2500,
        },
      }),
    } as unknown as jest.Mocked<BenchmarkingService>;
    return { service: new BiExportService(analyticsService, benchmarkingService) };
  }

  it("exports the corporate dashboard as CSV with a totals row and escapes commas in branch names", async () => {
    const { service } = makeService();
    const file = await service.exportCorporateDashboardCsv("org-1", {});
    expect(file.mimeType).toBe("text/csv");
    expect(file.content).toContain('"Branch, One",10000,4,2500');
    expect(file.content).toContain("TOTAL,10000,4,2500");
  });

  it("exports the branch benchmark as CSV", async () => {
    const { service } = makeService();
    const file = await service.exportBenchmarkCsv("org-1", {});
    expect(file.content).toContain(
      "Rank,Branch,RevenueMinor,Orders,AverageOrderValueMinor,PercentVsAverage",
    );
    expect(file.content).toContain("1,Branch 1,10000,4,2500,0");
  });

  it("exports the executive scorecard as CSV", async () => {
    const { service } = makeService();
    const file = await service.exportExecutiveScorecardCsv("org-1", {});
    expect(file.content).toContain("Revenue Growth %,100");
    expect(file.content).toContain("Top Branch,Branch 1");
  });
});
