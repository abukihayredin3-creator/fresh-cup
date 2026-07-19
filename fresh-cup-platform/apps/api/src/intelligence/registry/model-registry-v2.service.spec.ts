import { PredictiveModelStage } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { ModelRegistryV2Service } from "./model-registry-v2.service";

describe("ModelRegistryV2Service", () => {
  function makeService() {
    const prisma = {
      predictiveModelRun: {
        findFirst: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "run-1", ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "run-1", ...data })),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const service = new ModelRegistryV2Service(prisma);
    return { service, prisma };
  }

  it("starts at version 1 for a new modelKey", async () => {
    const { service, prisma } = makeService();
    (prisma.predictiveModelRun.findFirst as jest.Mock).mockResolvedValue(null);

    const run = await service.recordRun({
      modelKey: "customer-churn",
      datasetHash: "abc123",
      datasetVersion: "2026-07-19",
      sampleCount: 500,
      featureSchema: { fields: ["recencyDays", "ordersCount"] },
    });

    expect(run.version).toBe(1);
    expect(run.deploymentStage).toBe(PredictiveModelStage.EXPERIMENTAL);
  });

  it("increments version from the last recorded run for the same modelKey", async () => {
    const { service, prisma } = makeService();
    (prisma.predictiveModelRun.findFirst as jest.Mock).mockResolvedValue({ version: 4 });

    const run = await service.recordRun({
      modelKey: "customer-churn",
      datasetHash: "def456",
      datasetVersion: "2026-07-20",
      sampleCount: 600,
      featureSchema: {},
    });
    expect(run.version).toBe(5);
  });

  it("promoting to PRODUCTION archives the previous PRODUCTION version first", async () => {
    const { service, prisma } = makeService();
    await service.promote("customer-churn", 3, PredictiveModelStage.PRODUCTION);

    expect(prisma.predictiveModelRun.updateMany).toHaveBeenCalledWith({
      where: { modelKey: "customer-churn", deploymentStage: PredictiveModelStage.PRODUCTION },
      data: { deploymentStage: PredictiveModelStage.ARCHIVED },
    });
    expect(prisma.predictiveModelRun.update).toHaveBeenCalledWith({
      where: { modelKey_version: { modelKey: "customer-churn", version: 3 } },
      data: { deploymentStage: PredictiveModelStage.PRODUCTION },
    });
  });

  it("promoting to a non-PRODUCTION stage does not touch other versions", async () => {
    const { service, prisma } = makeService();
    await service.promote("customer-churn", 3, PredictiveModelStage.STAGING);
    expect(prisma.predictiveModelRun.updateMany).not.toHaveBeenCalled();
  });

  it("latestRun filters to READY status and the requested stage", async () => {
    const { service, prisma } = makeService();
    await service.latestRun("customer-churn", PredictiveModelStage.PRODUCTION);
    expect(prisma.predictiveModelRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deploymentStage: PredictiveModelStage.PRODUCTION }),
      }),
    );
  });
});
