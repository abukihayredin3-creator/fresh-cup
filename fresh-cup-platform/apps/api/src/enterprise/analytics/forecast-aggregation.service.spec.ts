import type { ForecastingFacadeService } from "../../intelligence/forecasting/forecasting-facade.service";
import { ForecastAggregationService } from "./forecast-aggregation.service";
import type { EnterpriseAnalyticsService } from "./enterprise-analytics.service";

describe("ForecastAggregationService", () => {
  function makeService(orgBranches: { id: string; name: string }[]) {
    const analyticsService = {
      listOrgBranches: jest.fn().mockResolvedValue(orgBranches),
    } as unknown as jest.Mocked<EnterpriseAnalyticsService>;
    const forecastingFacade = {
      revenue: jest.fn().mockImplementation((branchId: string) =>
        Promise.resolve({
          modelKey: "sales-revenue",
          modelVersion: 1,
          prediction: branchId === "b1" ? 500 : 300,
          confidence: branchId === "b1" ? 0.8 : 0.6,
          topReasons: [],
          contributingFactors: [],
          suggestedAction: "",
        }),
      ),
    } as unknown as jest.Mocked<ForecastingFacadeService>;
    return {
      service: new ForecastAggregationService(analyticsService, forecastingFacade),
      forecastingFacade,
    };
  }

  it("sums per-branch predicted revenue (converted to minor units) and averages confidence", async () => {
    const { service } = makeService([
      { id: "b1", name: "Branch 1" },
      { id: "b2", name: "Branch 2" },
    ]);
    const result = await service.aggregateOrgRevenueForecast("org-1");
    expect(result.branchCount).toBe(2);
    expect(result.totalPredictedRevenueMinor).toBe(80000);
    expect(result.averageConfidence).toBe(0.7);
    expect(result.byBranch).toHaveLength(2);
  });

  it("returns a zeroed aggregate for no branches without calling the forecast facade", async () => {
    const { service, forecastingFacade } = makeService([]);
    const result = await service.aggregateOrgRevenueForecast("org-1");
    expect(result).toEqual({
      branchCount: 0,
      totalPredictedRevenueMinor: 0,
      averageConfidence: 0,
      byBranch: [],
    });
    expect(forecastingFacade.revenue).not.toHaveBeenCalled();
  });
});
