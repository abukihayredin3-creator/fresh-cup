import { Injectable, NotFoundException } from "@nestjs/common";
import {
  RecommendationOutcomeStatus,
  type AiEvaluationRecord,
  type AiRecommendationOutcome,
  type Prisma,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface RecordMetricInput {
  metricName: string;
  value: number;
  modelKey?: string;
  context?: Record<string, unknown>;
}

export interface RecordOutcomeInput {
  source: string;
  recommendation: string;
  estimatedImpact?: number;
}

/**
 * Continuous Evaluation (Phase 11 Part 3) — tracks the metrics the spec
 * names: accuracy/precision/recall/latency go through `record()` as
 * time-series `AiEvaluationRecord` rows (Part 2's `evaluation/metrics.util.ts`
 * computes the actual precision/recall/F1/ROC AUC/MAPE/RMSE/MAE numbers;
 * this service is where those numbers get logged over time so a trend is
 * queryable). Recommendation Acceptance / Business Impact / ROI come from
 * `AiRecommendationOutcome` — every domain service that surfaces a
 * recommendation can log one via `recordOutcome()`, then whoever reviews
 * it calls `decide()`.
 *
 * Hallucination rate is NOT computed automatically — this platform has no
 * ground-truth signal to detect a fabricated claim (its explanations are
 * template/LLM text built from real query results, not free generation
 * against unverified facts), so `flagHallucination()` is a manual admin
 * action instead of an automatic detector. Documented gap, not an
 * oversight.
 */
@Injectable()
export class EvaluationTrackerService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordMetricInput): Promise<AiEvaluationRecord> {
    return this.prisma.aiEvaluationRecord.create({
      data: {
        metricName: input.metricName,
        value: input.value,
        modelKey: input.modelKey,
        context: input.context as Prisma.InputJsonValue | undefined,
      },
    });
  }

  trend(metricName: string, modelKey?: string, limit = 50): Promise<AiEvaluationRecord[]> {
    return this.prisma.aiEvaluationRecord.findMany({
      where: { metricName, modelKey },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
  }

  recordOutcome(input: RecordOutcomeInput): Promise<AiRecommendationOutcome> {
    return this.prisma.aiRecommendationOutcome.create({
      data: {
        source: input.source,
        recommendation: input.recommendation,
        estimatedImpact: input.estimatedImpact,
      },
    });
  }

  async decideOutcome(
    id: string,
    status: Exclude<RecommendationOutcomeStatus, "PENDING">,
    actorUserId: string,
    actualImpact?: number,
  ): Promise<AiRecommendationOutcome> {
    await this.findOutcomeOrThrow(id);
    return this.prisma.aiRecommendationOutcome.update({
      where: { id },
      data: { status, decidedByUserId: actorUserId, decidedAt: new Date(), actualImpact },
    });
  }

  async flagHallucination(id: string): Promise<AiRecommendationOutcome> {
    await this.findOutcomeOrThrow(id);
    return this.prisma.aiRecommendationOutcome.update({
      where: { id },
      data: { flaggedHallucination: true },
    });
  }

  private async findOutcomeOrThrow(id: string): Promise<AiRecommendationOutcome> {
    const outcome = await this.prisma.aiRecommendationOutcome.findUnique({ where: { id } });
    if (!outcome) {
      throw new NotFoundException("Recommendation outcome not found");
    }
    return outcome;
  }

  async acceptanceRate(
    source?: string,
  ): Promise<{ accepted: number; rejected: number; rate: number }> {
    const [accepted, rejected] = await Promise.all([
      this.prisma.aiRecommendationOutcome.count({
        where: { source, status: RecommendationOutcomeStatus.ACCEPTED },
      }),
      this.prisma.aiRecommendationOutcome.count({
        where: { source, status: RecommendationOutcomeStatus.REJECTED },
      }),
    ]);
    const decided = accepted + rejected;
    return { accepted, rejected, rate: decided === 0 ? 0 : accepted / decided };
  }

  async businessImpact(source?: string): Promise<{ estimatedTotal: number; actualTotal: number }> {
    const accepted = await this.prisma.aiRecommendationOutcome.findMany({
      where: { source, status: RecommendationOutcomeStatus.ACCEPTED },
      select: { estimatedImpact: true, actualImpact: true },
    });
    return {
      estimatedTotal: accepted.reduce((sum, o) => sum + (o.estimatedImpact ?? 0), 0),
      actualTotal: accepted.reduce((sum, o) => sum + (o.actualImpact ?? 0), 0),
    };
  }
}
