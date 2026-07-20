import { Injectable } from "@nestjs/common";
import { AiRecommendationStatus } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { AiBrainStatusResponseDto } from "../dto/status-response.dto";
import { PredictionEngineService } from "./prediction-engine.service";

/** Backs `GET /ai-brain/status` — a lightweight org-scoped overview of the AI Brain's own state. */
@Injectable()
export class AiBrainStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prediction: PredictionEngineService,
  ) {}

  async getStatus(organizationId: string): Promise<AiBrainStatusResponseDto> {
    const [
      insightCount,
      memoryCount,
      recommendationCount,
      pendingRecommendationCount,
      decisionCount,
    ] = await Promise.all([
      this.prisma.aiInsight.count({ where: { organizationId } }),
      this.prisma.aiMemory.count({ where: { organizationId } }),
      this.prisma.aiRecommendation.count({ where: { organizationId } }),
      this.prisma.aiRecommendation.count({
        where: { organizationId, status: AiRecommendationStatus.PENDING },
      }),
      this.prisma.aiDecision.count({ where: { organizationId } }),
    ]);

    return {
      organizationId,
      insightCount,
      memoryCount,
      recommendationCount,
      pendingRecommendationCount,
      decisionCount,
      predictionProvider: this.prediction.name,
      generatedAt: new Date(),
    };
  }
}
