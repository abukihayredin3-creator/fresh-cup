import { Injectable, NotFoundException } from "@nestjs/common";
import { AiRecommendationStatus, type AiLearningEvent, type Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { LearningFeedbackInput } from "../interfaces/ai-brain.interfaces";

const STATUS_TRANSITIONS = new Set<string>([
  AiRecommendationStatus.ACCEPTED,
  AiRecommendationStatus.REJECTED,
  AiRecommendationStatus.IMPLEMENTED,
]);

/**
 * The feedback loop: tracks what happened to an AiRecommendation — was it
 * accepted, rejected, implemented, and what was the observed business
 * outcome. Every AI Brain recommendation is only as good as this loop;
 * later phases (real ML/agent engines) train against AiLearningEvent
 * history, so its shape stays deliberately simple and durable now.
 */
@Injectable()
export class LearningEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async recordFeedback(
    organizationId: string,
    input: LearningFeedbackInput,
  ): Promise<AiLearningEvent> {
    const recommendation = await this.prisma.aiRecommendation.findFirst({
      where: { id: input.recommendationId, organizationId },
      select: { id: true },
    });
    if (!recommendation) {
      throw new NotFoundException(
        `Recommendation ${input.recommendationId} not found in this organization`,
      );
    }

    const nextStatus = this.resolveStatus(input.result);
    if (!nextStatus) {
      return this.prisma.aiLearningEvent.create({
        data: {
          recommendationId: input.recommendationId,
          result: input.result,
          feedback: input.feedback as Prisma.InputJsonValue,
        },
      });
    }

    const [event] = await this.prisma.$transaction([
      this.prisma.aiLearningEvent.create({
        data: {
          recommendationId: input.recommendationId,
          result: input.result,
          feedback: input.feedback as Prisma.InputJsonValue,
        },
      }),
      this.prisma.aiRecommendation.update({
        where: { id: input.recommendationId },
        data: { status: nextStatus },
      }),
    ]);
    return event;
  }

  async outcomesFor(organizationId: string, recommendationId: string): Promise<AiLearningEvent[]> {
    const recommendation = await this.prisma.aiRecommendation.findFirst({
      where: { id: recommendationId, organizationId },
      select: { id: true },
    });
    if (!recommendation) {
      throw new NotFoundException(
        `Recommendation ${recommendationId} not found in this organization`,
      );
    }

    return this.prisma.aiLearningEvent.findMany({
      where: { recommendationId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Maps a free-form `result` string to a recommendation lifecycle status, when it names one. */
  private resolveStatus(result: string): AiRecommendationStatus | null {
    const normalized = result.trim().toUpperCase();
    return STATUS_TRANSITIONS.has(normalized) ? (normalized as AiRecommendationStatus) : null;
  }
}
