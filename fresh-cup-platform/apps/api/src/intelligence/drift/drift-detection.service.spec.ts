import { DriftSeverity, DriftType } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { DriftDetectionService } from "./drift-detection.service";

describe("DriftDetectionService", () => {
  function makeService() {
    const prisma = {
      driftAlert: {
        create: jest.fn().mockResolvedValue({ id: "alert-1" }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: "alert-1", resolvedAt: new Date() }),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const service = new DriftDetectionService(prisma);
    return { service, prisma };
  }

  it("reports LOW severity and does not persist an alert for identical distributions", async () => {
    const { service, prisma } = makeService();
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = await service.detectFeatureDrift(
      "customer-churn",
      "recencyDays",
      values,
      values,
    );

    expect(result.severity).toBe(DriftSeverity.LOW);
    expect(result.isSignificant).toBe(false);
    expect(prisma.driftAlert.create).not.toHaveBeenCalled();
  });

  it("reports HIGH severity and persists an alert for a completely shifted distribution", async () => {
    const { service, prisma } = makeService();
    const baseline = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const current = [91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
    const result = await service.detectFeatureDrift(
      "customer-churn",
      "recencyDays",
      baseline,
      current,
    );

    expect(result.severity).toBe(DriftSeverity.HIGH);
    expect(result.isSignificant).toBe(true);
    expect(prisma.driftAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelKey: "customer-churn",
          driftType: DriftType.FEATURE_DRIFT,
        }),
      }),
    );
  });

  it("detects prediction drift the same way as feature drift", async () => {
    const { service } = makeService();
    const result = await service.detectPredictionDrift(
      "customer-churn",
      [0.1, 0.1, 0.1],
      [0.9, 0.9, 0.9],
    );
    expect(result.driftType).toBe(DriftType.PREDICTION_DRIFT);
    expect(result.isSignificant).toBe(true);
  });

  it("flags data drift on a large relative volume change", async () => {
    const { service, prisma } = makeService();
    const result = await service.detectDataDrift("sales-forecast", 1000, 300);
    expect(result.severity).toBe(DriftSeverity.HIGH);
    expect(prisma.driftAlert.create).toHaveBeenCalled();
  });

  it("does not flag data drift on a small relative volume change", async () => {
    const { service, prisma } = makeService();
    const result = await service.detectDataDrift("sales-forecast", 1000, 1050);
    expect(result.isSignificant).toBe(false);
    expect(prisma.driftAlert.create).not.toHaveBeenCalled();
  });

  it("flags concept drift on a large accuracy drop", async () => {
    const { service, prisma } = makeService();
    const result = await service.detectConceptDrift("customer-churn", 0.85, 0.6);
    expect(result.severity).toBe(DriftSeverity.HIGH);
    expect(prisma.driftAlert.create).toHaveBeenCalled();
  });

  it("resolveAlert sets resolvedAt", async () => {
    const { service, prisma } = makeService();
    await service.resolveAlert("alert-1");
    expect(prisma.driftAlert.update).toHaveBeenCalledWith({
      where: { id: "alert-1" },
      data: { resolvedAt: expect.any(Date) },
    });
  });
});
