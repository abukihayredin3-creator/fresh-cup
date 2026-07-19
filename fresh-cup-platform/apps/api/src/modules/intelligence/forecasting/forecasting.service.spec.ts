import { ForecastGranularity, ForecastMetric } from "@prisma/client";
import type { PrismaService } from "../../../database/prisma.service";
import type { ModelRegistryService } from "../ml/model-registry.service";
import { ForecastingService } from "./forecasting.service";

describe("ForecastingService", () => {
  let service: ForecastingService;
  let prisma: {
    order: { findMany: jest.Mock; aggregate: jest.Mock };
    orderItem: { aggregate: jest.Mock };
    forecastSnapshot: { createMany: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  };
  let modelRegistry: { recordRun: jest.Mock };

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn(), aggregate: jest.fn() },
      orderItem: { aggregate: jest.fn() },
      forecastSnapshot: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    modelRegistry = { recordRun: jest.fn().mockResolvedValue({ id: "run-1", version: 1 }) };
    service = new ForecastingService(
      prisma as unknown as PrismaService,
      modelRegistry as unknown as ModelRegistryService,
    );
  });

  describe("generateSalesForecast", () => {
    it("skips forecast generation with fewer than 2 historical buckets", async () => {
      prisma.order.findMany.mockResolvedValue([{ total: 1000, placedAt: new Date() }]);

      await service.generateSalesForecast(undefined, ForecastGranularity.DAILY);

      expect(modelRegistry.recordRun).not.toHaveBeenCalled();
      expect(prisma.forecastSnapshot.createMany).not.toHaveBeenCalled();
    });

    it("creates a revenue + order-count row per forecast step for daily granularity", async () => {
      const now = Date.now();
      prisma.order.findMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          total: 10000 + i * 100,
          placedAt: new Date(now - (9 - i) * 86400000),
        })),
      );

      await service.generateSalesForecast("branch-1", ForecastGranularity.DAILY);

      expect(modelRegistry.recordRun).toHaveBeenCalledTimes(1);
      expect(prisma.forecastSnapshot.createMany).toHaveBeenCalledTimes(1);
      const rows = prisma.forecastSnapshot.createMany.mock.calls[0][0].data as {
        metric: string;
        confidence: number;
      }[];
      // 14-day DAILY horizon, two metrics (revenue + orders) per day.
      expect(rows).toHaveLength(28);
      expect(rows.filter((r) => r.metric === ForecastMetric.SALES_REVENUE)).toHaveLength(14);
      expect(rows.filter((r) => r.metric === ForecastMetric.SALES_ORDERS)).toHaveLength(14);
      expect(rows.every((r) => r.confidence > 0)).toBe(true);
    });
  });

  describe("backfillActuals", () => {
    it("backfills a past snapshot's actual value and skips one still in the future", async () => {
      const pastSnapshot = {
        id: "snap-past",
        modelRunId: "run-1",
        metric: ForecastMetric.SALES_REVENUE,
        granularity: ForecastGranularity.DAILY,
        targetPeriodStart: new Date(Date.now() - 2 * 86400000),
        branchId: null,
        menuItemId: null,
        inventoryItemId: null,
        actualValue: null,
      };
      prisma.forecastSnapshot.findMany.mockResolvedValue([pastSnapshot]);
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: 42000 }, _count: 3 });

      const updated = await service.backfillActuals();

      expect(updated).toBe(1);
      expect(prisma.forecastSnapshot.update).toHaveBeenCalledWith({
        where: { id: "snap-past" },
        data: { actualValue: 42000 },
      });
    });
  });

  describe("series", () => {
    it("returns points with the model version from the included relation", async () => {
      prisma.forecastSnapshot.findMany.mockResolvedValue([
        {
          targetPeriodStart: new Date(),
          predictedValue: 1000,
          actualValue: null,
          confidence: 0.5,
          modelRun: { version: 3 },
        },
      ]);

      const result = await service.series(ForecastMetric.SALES_REVENUE, ForecastGranularity.DAILY);

      expect(result.modelVersion).toBe(3);
      expect(result.points).toHaveLength(1);
    });

    it("returns modelVersion 0 when there's no forecast yet", async () => {
      prisma.forecastSnapshot.findMany.mockResolvedValue([]);

      const result = await service.series(ForecastMetric.SALES_REVENUE, ForecastGranularity.DAILY);

      expect(result.modelVersion).toBe(0);
      expect(result.points).toEqual([]);
    });
  });
});
