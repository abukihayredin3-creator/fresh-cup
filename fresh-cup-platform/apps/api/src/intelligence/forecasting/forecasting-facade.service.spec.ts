import { ForecastGranularity, ForecastMetric } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import type { ForecastingService } from "../../modules/intelligence/forecasting/forecasting.service";
import { ConfidenceCalibratorService } from "../calibration/confidence-calibrator.service";
import type { ModelRegistryV2Service } from "../registry/model-registry-v2.service";
import type { SalesAiService } from "../services/sales-ai/sales-ai.service";
import { ForecastingFacadeService } from "./forecasting-facade.service";

function futureSnapshot(
  predictedValue: number,
  confidence = 0.7,
  actualValue: number | null = null,
) {
  return {
    targetPeriodStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
    predictedValue,
    confidence,
    actualValue,
  };
}

describe("ForecastingFacadeService", () => {
  function makeService() {
    const prisma = {
      menuItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as jest.Mocked<PrismaService>;
    const forecastingService = {
      series: jest.fn(),
      productDemand: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ForecastingService>;
    const salesAi = {
      averageTicketPrediction: jest.fn(),
      bestSellerPrediction: jest.fn(),
    } as unknown as jest.Mocked<SalesAiService>;
    const registry = {
      latestRun: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<ModelRegistryV2Service>;
    const calibrator = new ConfidenceCalibratorService();

    const service = new ForecastingFacadeService(
      prisma,
      forecastingService,
      salesAi,
      calibrator,
      registry,
    );
    return { service, prisma, forecastingService, salesAi, registry };
  }

  it("wraps a sales-revenue forecast series into a PredictionResultDto", async () => {
    const { service, forecastingService } = makeService();
    forecastingService.series.mockResolvedValue({
      modelVersion: 2,
      points: [futureSnapshot(150000, 0.8)] as never,
    });

    const result = await service.dailySales("branch-1");
    expect(forecastingService.series).toHaveBeenCalledWith(
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.DAILY,
      "branch-1",
    );
    expect(result.modelKey).toBe("sales-daily");
    expect(result.prediction).toBe(1500);
    expect(result.confidence).toBe(0.8);
  });

  it("requests the correct metric/granularity for hourly/weekly/monthly/transactions", async () => {
    const { service, forecastingService } = makeService();
    forecastingService.series.mockResolvedValue({ modelVersion: 1, points: [] });

    await service.hourlySales();
    expect(forecastingService.series).toHaveBeenCalledWith(
      ForecastMetric.HOURLY_DEMAND,
      ForecastGranularity.HOURLY,
      undefined,
    );

    await service.weeklySales();
    expect(forecastingService.series).toHaveBeenCalledWith(
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.WEEKLY,
      undefined,
    );

    await service.monthlySales();
    expect(forecastingService.series).toHaveBeenCalledWith(
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.MONTHLY,
      undefined,
    );

    await service.transactions();
    expect(forecastingService.series).toHaveBeenCalledWith(
      ForecastMetric.SALES_ORDERS,
      ForecastGranularity.DAILY,
      undefined,
    );
  });

  it("returns a graceful fallback when there is no future forecast point", async () => {
    const { service, forecastingService } = makeService();
    forecastingService.series.mockResolvedValue({ modelVersion: 0, points: [] });
    const result = await service.dailySales();
    expect(result.prediction).toBe(0);
    expect(result.suggestedAction).toContain("regenerates nightly");
  });

  it("wraps SalesAiService.averageTicketPrediction", async () => {
    const { service, salesAi } = makeService();
    salesAi.averageTicketPrediction.mockResolvedValue({
      title: "t",
      explanation: "explained",
      confidence: 0.7,
      data: { predictedAvgTicketEtb: 55, predictedOrders: 10 },
    });
    const result = await service.averageTicket();
    expect(result.prediction).toBe(55);
    expect(result.modelKey).toBe("sales-average-ticket");
  });

  it("wraps SalesAiService.bestSellerPrediction", async () => {
    const { service, salesAi } = makeService();
    salesAi.bestSellerPrediction.mockResolvedValue({
      title: "t",
      explanation: "explained",
      confidence: 0.6,
      data: { topProducts: [{ nameEn: "Mango Smoothie", totalPredicted: 100 }] },
    });
    const result = await service.bestSellers();
    expect(result.prediction).toEqual([{ nameEn: "Mango Smoothie", totalPredicted: 100 }]);
  });

  it("groups product demand forecasts by category and ranks by total predicted volume", async () => {
    const { service, forecastingService, prisma } = makeService();
    forecastingService.productDemand.mockResolvedValue([
      {
        menuItemId: "m1",
        nameEn: "Mango Smoothie",
        points: [{ predictedValue: 10 }, { predictedValue: 20 }],
      },
      {
        menuItemId: "m2",
        nameEn: "Avocado Juice",
        points: [{ predictedValue: 5 }, { predictedValue: 5 }],
      },
    ] as never);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: "m1", categoryId: "c1", category: { nameEn: "Smoothies" } },
      { id: "m2", categoryId: "c2", category: { nameEn: "Juices" } },
    ]);

    const result = await service.categoryTrends();
    expect(result.prediction[0]!.category).toBe("Smoothies");
    expect(result.prediction[0]!.totalPredicted).toBe(30);
    expect(result.prediction[0]!.trend).toBe("rising");
  });

  it("uses the registry's latest version when one is recorded", async () => {
    const { service, forecastingService, registry } = makeService();
    forecastingService.series.mockResolvedValue({
      modelVersion: 1,
      points: [futureSnapshot(1000)] as never,
    });
    (registry.latestRun as jest.Mock).mockResolvedValue({ version: 4 });

    const result = await service.dailySales();
    expect(result.modelVersion).toBe(4);
  });
});
