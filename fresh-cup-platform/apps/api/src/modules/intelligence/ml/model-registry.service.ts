import { Injectable } from "@nestjs/common";
import { MlModelStatus, type MlModelRun, type Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";

/**
 * Minimal model registry: every forecast-generation run gets a versioned
 * row here (auto-incrementing per `modelKey`), so a forecast snapshot can
 * always be traced back to the run that produced it, and offline evaluation
 * (`metrics`) travels with the run rather than being recomputed each time.
 */
@Injectable()
export class ModelRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordRun(
    modelKey: string,
    options: { metrics?: Prisma.InputJsonValue; notes?: string; status?: MlModelStatus } = {},
  ): Promise<MlModelRun> {
    const last = await this.prisma.mlModelRun.findFirst({
      where: { modelKey },
      orderBy: { version: "desc" },
    });
    const version = (last?.version ?? 0) + 1;
    return this.prisma.mlModelRun.create({
      data: {
        modelKey,
        version,
        status: options.status ?? MlModelStatus.READY,
        metrics: options.metrics,
        notes: options.notes,
      },
    });
  }

  latestRun(modelKey: string): Promise<MlModelRun | null> {
    return this.prisma.mlModelRun.findFirst({
      where: { modelKey, status: MlModelStatus.READY },
      orderBy: { version: "desc" },
    });
  }

  listRuns(modelKey?: string): Promise<MlModelRun[]> {
    return this.prisma.mlModelRun.findMany({
      where: modelKey ? { modelKey } : undefined,
      orderBy: { trainedAt: "desc" },
      take: 50,
    });
  }
}
