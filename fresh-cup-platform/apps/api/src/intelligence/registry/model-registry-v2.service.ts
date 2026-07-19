import { Injectable } from "@nestjs/common";
import {
  MlModelStatus,
  PredictiveModelStage,
  type Prisma,
  type PredictiveModelRun,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface RecordPredictiveRunInput {
  modelKey: string;
  datasetHash: string;
  datasetVersion: string;
  sampleCount: number;
  featureSchema: Prisma.InputJsonValue;
  metrics?: Prisma.InputJsonValue;
  notes?: string;
  status?: MlModelStatus;
}

/**
 * Registry for every prediction/forecasting/segmentation model (distinct
 * from Phase 6's `ModelRegistryService`/`MlModelRun`, which only tracks
 * forecast-generation runs) — same auto-incrementing-version-per-modelKey
 * pattern, extended with the deployment-stage lifecycle and dataset
 * lineage (hash/version/sample count/feature schema) this phase's spec
 * requires. `promote()` enforces at most one PRODUCTION version per
 * modelKey — promoting a new one automatically archives the previous.
 */
@Injectable()
export class ModelRegistryV2Service {
  constructor(private readonly prisma: PrismaService) {}

  async recordRun(input: RecordPredictiveRunInput): Promise<PredictiveModelRun> {
    const last = await this.prisma.predictiveModelRun.findFirst({
      where: { modelKey: input.modelKey },
      orderBy: { version: "desc" },
    });
    const version = (last?.version ?? 0) + 1;
    return this.prisma.predictiveModelRun.create({
      data: {
        modelKey: input.modelKey,
        version,
        status: input.status ?? MlModelStatus.READY,
        deploymentStage: PredictiveModelStage.EXPERIMENTAL,
        datasetHash: input.datasetHash,
        datasetVersion: input.datasetVersion,
        sampleCount: input.sampleCount,
        featureSchema: input.featureSchema,
        metrics: input.metrics,
        notes: input.notes,
      },
    });
  }

  latestRun(modelKey: string, stage?: PredictiveModelStage): Promise<PredictiveModelRun | null> {
    return this.prisma.predictiveModelRun.findFirst({
      where: { modelKey, status: MlModelStatus.READY, deploymentStage: stage },
      orderBy: { version: "desc" },
    });
  }

  listRuns(modelKey?: string): Promise<PredictiveModelRun[]> {
    return this.prisma.predictiveModelRun.findMany({
      where: modelKey ? { modelKey } : undefined,
      orderBy: [{ modelKey: "asc" }, { version: "desc" }],
      take: 100,
    });
  }

  listByStage(stage: PredictiveModelStage): Promise<PredictiveModelRun[]> {
    return this.prisma.predictiveModelRun.findMany({
      where: { deploymentStage: stage },
      orderBy: { trainedAt: "desc" },
    });
  }

  async promote(
    modelKey: string,
    version: number,
    stage: PredictiveModelStage,
  ): Promise<PredictiveModelRun> {
    if (stage === PredictiveModelStage.PRODUCTION) {
      await this.prisma.predictiveModelRun.updateMany({
        where: { modelKey, deploymentStage: PredictiveModelStage.PRODUCTION },
        data: { deploymentStage: PredictiveModelStage.ARCHIVED },
      });
    }
    return this.prisma.predictiveModelRun.update({
      where: { modelKey_version: { modelKey, version } },
      data: { deploymentStage: stage },
    });
  }
}
