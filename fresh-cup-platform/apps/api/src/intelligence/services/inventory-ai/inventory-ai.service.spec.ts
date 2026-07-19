import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { ForecastGranularity, ForecastMetric, PurchaseOrderStatus } from "@prisma/client";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { PrismaService } from "../../../database/prisma.service";
import type { ForecastingService } from "../../../modules/intelligence/forecasting/forecasting.service";
import type { InventoryIntelligenceService } from "../../../modules/intelligence/inventory-intelligence/inventory-intelligence.service";
import type { ExplanationService } from "../explanation.service";
import { InventoryAiService } from "./inventory-ai.service";

describe("InventoryAiService", () => {
  function makeService(forecastingEnabled = true) {
    const prisma = {
      supplier: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as jest.Mocked<PrismaService>;
    const inventoryIntelligence = {
      intelligence: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<InventoryIntelligenceService>;
    const forecastingService = { series: jest.fn() } as unknown as jest.Mocked<ForecastingService>;
    const explanation = {
      explain: jest
        .fn()
        .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
    } as unknown as jest.Mocked<ExplanationService>;
    const config = { get: () => forecastingEnabled } as unknown as ConfigService<
      EnvironmentVariables,
      true
    >;

    const service = new InventoryAiService(
      config,
      prisma,
      inventoryIntelligence,
      forecastingService,
      explanation,
    );
    return { service, prisma, inventoryIntelligence, forecastingService };
  }

  it("only recommends restocking for items with a positive suggested reorder quantity", async () => {
    const { service, inventoryIntelligence } = makeService();
    inventoryIntelligence.intelligence.mockResolvedValue([
      {
        name: "Mango",
        suggestedReorderQuantity: 10,
        currentStock: 2,
        avgDailyConsumption: 3,
        daysUntilStockout: 1,
        suggestedReorderCost: 5000,
      } as never,
      {
        name: "Kale",
        suggestedReorderQuantity: 0,
        currentStock: 50,
        avgDailyConsumption: 1,
        daysUntilStockout: 30,
        suggestedReorderCost: 0,
      } as never,
    ]);

    const results = await service.restockingRecommendations();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Restock: Mango");
  });

  it("only flags waste risk for items above the 0.1 threshold", async () => {
    const { service, inventoryIntelligence } = makeService();
    inventoryIntelligence.intelligence.mockResolvedValue([
      { name: "Mango", wasteProbability: 0.15, expiryRisk: 0.3, avgDailyConsumption: 3 } as never,
      { name: "Kale", wasteProbability: 0.05, expiryRisk: null, avgDailyConsumption: 1 } as never,
    ]);

    const results = await service.wastePrediction();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Waste risk: Mango");
  });

  it("throws ForbiddenException for ingredient demand forecast when AI_FORECASTING_ENABLED is false", async () => {
    const { service } = makeService(false);
    await expect(service.ingredientDemandForecast()).rejects.toThrow(ForbiddenException);
  });

  it("requests INGREDIENT_DEMAND forecasts when enabled", async () => {
    const { service, forecastingService } = makeService(true);
    forecastingService.series.mockResolvedValue({ modelVersion: 2, points: [] });
    await service.ingredientDemandForecast("branch-1");
    expect(forecastingService.series).toHaveBeenCalledWith(
      ForecastMetric.INGREDIENT_DEMAND,
      ForecastGranularity.DAILY,
      "branch-1",
    );
  });

  it("computes supplier lead time and reliability from purchase order history", async () => {
    const { service, prisma } = makeService();
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([
      {
        id: "sup-1",
        name: "Merkato Produce",
        purchaseOrders: [
          {
            status: PurchaseOrderStatus.RECEIVED,
            submittedAt: new Date("2026-06-01T00:00:00Z"),
            receivedAt: new Date("2026-06-03T00:00:00Z"),
          },
          {
            status: PurchaseOrderStatus.RECEIVED,
            submittedAt: new Date("2026-06-05T00:00:00Z"),
            receivedAt: new Date("2026-06-06T00:00:00Z"),
          },
          { status: PurchaseOrderStatus.CANCELLED, submittedAt: new Date(), receivedAt: null },
        ],
      },
    ]);

    const results = await service.supplierOptimization();
    expect(results).toHaveLength(1);
    const data = results[0]!.data as {
      avgLeadTimeDays: number;
      reliabilityRate: number;
      totalOrders: number;
    };
    expect(data.totalOrders).toBe(3);
    expect(data.avgLeadTimeDays).toBeCloseTo(1.5, 5);
    expect(data.reliabilityRate).toBeCloseTo(2 / 3, 2);
  });

  it("excludes suppliers with no non-draft purchase orders", async () => {
    const { service, prisma } = makeService();
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([
      { id: "sup-1", name: "No Orders Supplier", purchaseOrders: [] },
    ]);
    const results = await service.supplierOptimization();
    expect(results).toHaveLength(0);
  });
});
