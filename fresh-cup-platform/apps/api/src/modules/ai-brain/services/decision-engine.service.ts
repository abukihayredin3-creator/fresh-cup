import { Injectable } from "@nestjs/common";
import { AiPriority, type AiDecision, type Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { DecisionResult, ReasoningResult } from "../interfaces/ai-brain.interfaces";
import { PredictionEngineService } from "./prediction-engine.service";
import { ReasoningEngineService } from "./reasoning-engine.service";
import { RecommendationEngineService } from "./recommendation-engine.service";

/** A next-day forecast this far above/below the trailing daily average counts as a demand swing worth acting on. */
const DEMAND_SWING_THRESHOLD_PCT = 15;

const PRIORITY_RANK: Record<AiPriority, number> = {
  [AiPriority.CRITICAL]: 4,
  [AiPriority.HIGH]: 3,
  [AiPriority.MEDIUM]: 2,
  [AiPriority.LOW]: 1,
};

function priorityForMagnitude(confidence: number, magnitudePct: number): AiPriority {
  const severe = Math.abs(magnitudePct) >= 30;
  if (severe && confidence >= 0.75) {
    return AiPriority.CRITICAL;
  }
  if (severe || confidence >= 0.75) {
    return AiPriority.HIGH;
  }
  if (confidence >= 0.5) {
    return AiPriority.MEDIUM;
  }
  return AiPriority.LOW;
}

/**
 * The central AI decision layer: combines the Prediction Engine's
 * forecasts with the Reasoning Engine's trend analysis and the
 * Recommendation Engine's ranked suggestions into a single, prioritized
 * list of executive actions — {priority, action, reason, confidence}.
 * Persisted as AiDecision, sorted highest-priority-and-confidence first.
 */
@Injectable()
export class DecisionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reasoning: ReasoningEngineService,
    private readonly prediction: PredictionEngineService,
    private readonly recommendation: RecommendationEngineService,
  ) {}

  async decide(organizationId: string, branchId?: string): Promise<AiDecision[]> {
    const [recommendations, demandDecision] = await Promise.all([
      this.recommendation.generate(organizationId, branchId),
      this.demandForecastDecision(organizationId, branchId),
    ]);

    const candidates: DecisionResult[] = [
      ...recommendations.map((rec) => ({
        decisionType: "RECOMMENDATION_ACTION",
        priority: rec.priority,
        action: rec.title,
        reason: rec.description,
        confidence: rec.confidence,
      })),
      ...(demandDecision ? [demandDecision] : []),
    ];

    const ranked = candidates.sort(
      (a, b) =>
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.confidence - a.confidence,
    );

    return Promise.all(
      ranked.map((decision) =>
        this.prisma.aiDecision.create({
          data: {
            organizationId,
            decisionType: decision.decisionType,
            priority: decision.priority,
            confidence: decision.confidence,
            input: { branchId: branchId ?? null } as Prisma.InputJsonValue,
            output: {
              action: decision.action,
              reason: decision.reason,
            } as Prisma.InputJsonValue,
          },
        }),
      ),
    );
  }

  /**
   * Combines the Prediction Engine's next-day sales forecast with the
   * Reasoning Engine's trailing 7-day sales signal to flag a genuine
   * demand swing — the "predictions + reasoning" combination the Decision
   * Engine is meant to perform, not a hardcoded example.
   */
  private async demandForecastDecision(
    organizationId: string,
    branchId?: string,
  ): Promise<DecisionResult | null> {
    const [salesInsight, salesPrediction] = await Promise.all([
      this.reasoning.analyze(organizationId, "sales", branchId),
      this.prediction.predict({ organizationId, branchId, metric: "sales" }),
    ]);

    const content = salesInsight.content as unknown as ReasoningResult;
    if (content.signals.kind !== "sales") {
      return null;
    }

    const baseline = content.signals.trend.currentRevenue / 7;
    if (baseline <= 0) {
      return null;
    }

    const swingPct = ((salesPrediction.forecast - baseline) / baseline) * 100;
    if (Math.abs(swingPct) < DEMAND_SWING_THRESHOLD_PCT) {
      return null;
    }

    const confidence = Math.min(salesPrediction.confidence, content.confidence);
    const rising = swingPct > 0;

    return {
      decisionType: "DEMAND_FORECAST",
      priority: priorityForMagnitude(confidence, swingPct),
      action: rising
        ? "Increase production and staffing to meet forecasted demand"
        : "Reduce next-day prep and staffing — demand is forecast to fall",
      reason: `Sales are predicted to ${rising ? "rise" : "fall"} ${Math.abs(swingPct).toFixed(1)}% versus the trailing 7-day daily average`,
      confidence,
    };
  }
}
