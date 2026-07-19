import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { ForecastGranularity, ForecastMetric } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { ForecastingService } from "../../../modules/intelligence/forecasting/forecasting.service";
import type { RecommendationsService } from "../../../modules/intelligence/recommendations/recommendations.service";
import type { ExplanationService } from "../explanation.service";
import { SalesAiService } from "./sales-ai.service";

function futureSnapshot(predictedValue: number, confidence = 0.7) {
  return {
    targetPeriodStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
    predictedValue,
    confidence,
  };
}

describe("SalesAiService", () => {
  function makeService(enabled = true) {
    const forecastingService = {
      series: jest.fn(),
      hourlyDemand: jest.fn(),
      productDemand: jest.fn(),
    } as unknown as jest.Mocked<ForecastingService>;
    const recommendationsService = {
      upsellCrossSell: jest.fn(),
    } as unknown as jest.Mocked<RecommendationsService>;
    const explanation = {
      explain: jest
        .fn()
        .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
    } as unknown as jest.Mocked<ExplanationService>;
    const config = { get: () => enabled } as unknown as ConfigService<EnvironmentVariables, true>;

    const service = new SalesAiService(
      config,
      forecastingService,
      recommendationsService,
      explanation,
    );
    return { service, forecastingService, recommendationsService };
  }

  it("throws ForbiddenException when AI_FORECASTING_ENABLED is false", async () => {
    const { service } = makeService(false);
    await expect(service.demandForecast()).rejects.toThrow(ForbiddenException);
  });

  it("summarizes a sales demand forecast", async () => {
    const { service, forecastingService } = makeService();
    forecastingService.series.mockResolvedValue({
      modelVersion: 3,
      points: [futureSnapshot(150000, 0.8) as never],
    });

    const result = await service.demandForecast("branch-1");
    expect(forecastingService.series).toHaveBeenCalledWith(
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.DAILY,
      "branch-1",
    );
    expect(result.confidence).toBe(0.8);
  });

  it("picks the highest-demand hour for peak-hour prediction", async () => {
    const { service, forecastingService } = makeService();
    forecastingService.hourlyDemand.mockResolvedValue([
      { hour: 9, predictedOrders: 5, seasonalIndex: 0.5 },
      { hour: 12, predictedOrders: 40, seasonalIndex: 2 },
      { hour: 18, predictedOrders: 20, seasonalIndex: 1 },
    ]);

    const result = await service.peakHourPrediction();
    expect((result.data as { hour: number }[]).length).toBe(3);
    expect(result.explanation).toContain("Peak-hour prediction");
  });

  it("computes average ticket as predicted revenue / predicted orders", async () => {
    const { service, forecastingService } = makeService();
    forecastingService.series.mockImplementation((metric) =>
      Promise.resolve({
        modelVersion: 1,
        points: [futureSnapshot(metric === ForecastMetric.SALES_REVENUE ? 100000 : 10) as never],
      }),
    );

    const result = await service.averageTicketPrediction();
    expect((result.data as { predictedAvgTicketEtb: number }).predictedAvgTicketEtb).toBeCloseTo(
      100,
      5,
    );
  });

  it("sums forecast points per product for best-seller prediction", async () => {
    const { service, forecastingService } = makeService();
    forecastingService.productDemand.mockResolvedValue([
      {
        menuItemId: "m1",
        nameEn: "Mango Smoothie",
        points: [{ predictedValue: 10 }, { predictedValue: 15 }],
      },
      { menuItemId: "m2", nameEn: "Avocado Juice", points: [{ predictedValue: 5 }] },
    ] as never);

    const result = await service.bestSellerPrediction();
    expect((result.data as unknown[]).length).toBe(2);
    expect(result.explanation).toContain("Best-seller prediction");
  });

  it("delegates cross-sell opportunities to RecommendationsService.upsellCrossSell", async () => {
    const { service, recommendationsService } = makeService();
    recommendationsService.upsellCrossSell.mockResolvedValue([{ nameEn: "Ginger Shot" } as never]);

    const result = await service.crossSellOpportunities("item-1");
    expect(recommendationsService.upsellCrossSell).toHaveBeenCalledWith("item-1");
    expect((result.data as unknown[]).length).toBe(1);
  });
});
