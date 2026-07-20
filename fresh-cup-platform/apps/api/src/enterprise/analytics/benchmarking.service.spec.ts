import { BenchmarkingService } from "./benchmarking.service";
import type { EnterpriseAnalyticsService, RollupResult } from "./enterprise-analytics.service";

function rollup(byBranch: RollupResult["byBranch"]): RollupResult {
  const totalRevenueMinor = byBranch.reduce((sum, b) => sum + b.revenueMinor, 0);
  const totalOrders = byBranch.reduce((sum, b) => sum + b.orderCount, 0);
  return {
    branchCount: byBranch.length,
    totalRevenueMinor,
    totalOrders,
    averageOrderValueMinor: totalOrders > 0 ? Math.round(totalRevenueMinor / totalOrders) : 0,
    byBranch,
  };
}

describe("BenchmarkingService", () => {
  function makeService(corporateDashboardImpl: (...args: unknown[]) => Promise<RollupResult>) {
    const analyticsService = {
      corporateDashboard: jest.fn().mockImplementation(corporateDashboardImpl),
    } as unknown as jest.Mocked<EnterpriseAnalyticsService>;
    return { service: new BenchmarkingService(analyticsService), analyticsService };
  }

  it("ranks branches by revenue and computes percent vs. the org average", async () => {
    const { service } = makeService(() =>
      Promise.resolve(
        rollup([
          {
            id: "b1",
            name: "B1",
            revenueMinor: 30000,
            orderCount: 10,
            averageOrderValueMinor: 3000,
          },
          {
            id: "b2",
            name: "B2",
            revenueMinor: 10000,
            orderCount: 5,
            averageOrderValueMinor: 2000,
          },
        ]),
      ),
    );
    const result = await service.benchmarkBranches("org-1", {});
    expect(result[0]).toMatchObject({ id: "b1", rank: 1 });
    expect(result[0]!.percentVsAverage).toBeGreaterThan(0);
    expect(result[1]).toMatchObject({ id: "b2", rank: 2 });
    expect(result[1]!.percentVsAverage).toBeLessThan(0);
  });

  it("computes growth vs. the immediately prior period of equal length", async () => {
    let call = 0;
    const { service } = makeService(() => {
      call += 1;
      const revenue = call === 1 ? 20000 : 10000;
      return Promise.resolve(
        rollup([
          {
            id: "b1",
            name: "B1",
            revenueMinor: revenue,
            orderCount: 4,
            averageOrderValueMinor: revenue / 4,
          },
        ]),
      );
    });
    const scorecard = await service.executiveScorecard("org-1", {
      from: "2026-07-01",
      to: "2026-07-10",
    });
    expect(scorecard.totalRevenueMinor).toBe(20000);
    expect(scorecard.previousPeriodRevenueMinor).toBe(10000);
    expect(scorecard.revenueGrowthPercent).toBe(100);
    expect(scorecard.topBranch).toMatchObject({ id: "b1" });
    expect(scorecard.bottomBranch).toMatchObject({ id: "b1" });
  });

  it("handles zero branches without dividing by zero", async () => {
    const { service } = makeService(() => Promise.resolve(rollup([])));
    const result = await service.benchmarkBranches("org-1", {});
    expect(result).toEqual([]);
  });
});
