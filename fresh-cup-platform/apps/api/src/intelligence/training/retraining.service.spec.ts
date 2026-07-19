import type { PrismaService } from "../../database/prisma.service";
import type { ForecastingService } from "../../modules/intelligence/forecasting/forecasting.service";
import type { DriftDetectionService } from "../drift/drift-detection.service";
import type { ModelRegistryV2Service } from "../registry/model-registry-v2.service";
import { RetrainingService, TRAINABLE_MODEL_KEYS } from "./retraining.service";

describe("RetrainingService", () => {
  function makeService() {
    const prisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _min: { placedAt: new Date() }, _max: { placedAt: new Date() } }),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const registry = {
      listRuns: jest.fn().mockResolvedValue([]),
      recordRun: jest.fn().mockResolvedValue({ id: "run-1", version: 1 }),
    } as unknown as jest.Mocked<ModelRegistryV2Service>;
    const drift = {
      listAlerts: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DriftDetectionService>;
    const forecastingService = {
      regenerateAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ForecastingService>;

    const service = new RetrainingService(prisma, registry, drift, forecastingService);
    return { service, prisma, registry, drift, forecastingService };
  }

  describe("checkTriggers", () => {
    it("triggers on 'new_data' when a model has never been trained", async () => {
      const { service } = makeService();
      const result = await service.checkTriggers("customer-churn");
      expect(result.shouldRetrain).toBe(true);
      expect(result.reasons).toContain("new_data");
    });

    it("triggers on 'drift' when there are unresolved drift alerts", async () => {
      const { service, registry, drift } = makeService();
      registry.listRuns.mockResolvedValue([{ version: 1, trainedAt: new Date() } as never]);
      drift.listAlerts.mockResolvedValue([{ id: "a1" } as never]);

      const result = await service.checkTriggers("customer-churn");
      expect(result.reasons).toContain("drift");
    });

    it("triggers on 'new_data' when enough new orders have arrived since the last training run", async () => {
      const { service, registry, prisma } = makeService();
      registry.listRuns.mockResolvedValue([{ version: 1, trainedAt: new Date() } as never]);
      (prisma.order.count as jest.Mock).mockResolvedValue(60);

      const result = await service.checkTriggers("customer-churn");
      expect(result.reasons).toContain("new_data");
    });

    it("does not trigger when already trained recently with no drift and few new orders", async () => {
      const { service, registry, prisma } = makeService();
      registry.listRuns.mockResolvedValue([{ version: 1, trainedAt: new Date() } as never]);
      (prisma.order.count as jest.Mock).mockResolvedValue(5);

      const result = await service.checkTriggers("customer-churn");
      expect(result.shouldRetrain).toBe(false);
      expect(result.reasons).toEqual([]);
    });
  });

  describe("retrain", () => {
    it("regenerates Phase 6 forecasts for sales-* model keys", async () => {
      const { service, forecastingService } = makeService();
      await service.retrain("sales-daily", "manual");
      expect(forecastingService.regenerateAll).toHaveBeenCalled();
    });

    it("does not regenerate forecasts for customer-* model keys", async () => {
      const { service, forecastingService } = makeService();
      await service.retrain("customer-churn", "manual");
      expect(forecastingService.regenerateAll).not.toHaveBeenCalled();
    });

    it("records a new registry run with a dataset hash/version/sample count", async () => {
      const { service, registry } = makeService();
      await service.retrain("customer-churn", "drift");
      expect(registry.recordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          modelKey: "customer-churn",
          datasetHash: expect.any(String),
          datasetVersion: expect.any(String),
          sampleCount: expect.any(Number),
        }),
      );
    });
  });

  describe("checkAndRetrainAll", () => {
    it("retrains every model that needs it and reports every model checked", async () => {
      const { service, registry } = makeService();
      const results = await service.checkAndRetrainAll(["customer-churn", "sales-daily"]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.shouldRetrain)).toBe(true);
      expect(registry.recordRun).toHaveBeenCalledTimes(2);
    });

    it("defaults to the full TRAINABLE_MODEL_KEYS list", async () => {
      const { service, registry } = makeService();
      await service.checkAndRetrainAll();
      expect(registry.recordRun).toHaveBeenCalledTimes(TRAINABLE_MODEL_KEYS.length);
    });
  });
});
