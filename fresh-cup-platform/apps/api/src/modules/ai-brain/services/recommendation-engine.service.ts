import { Injectable } from "@nestjs/common";
import { AiPriority, type AiInsight, type AiRecommendation } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type {
  ReasoningCategory,
  ReasoningResult,
  RecommendationCandidate,
} from "../interfaces/ai-brain.interfaces";
import { ReasoningEngineService } from "./reasoning-engine.service";

const ALL_CATEGORIES: ReasoningCategory[] = ["sales", "inventory", "customer", "operational"];

function priorityFor(confidence: number, severe: boolean): AiPriority {
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
 * Turns the Reasoning Engine's structured signals into actionable,
 * explainable recommendations — {title, description, impact, confidence,
 * priority}. Reads the `signals` field on each ReasoningResult (real
 * numbers from Prisma, see ReasoningEngineService) rather than parsing the
 * human-readable `causes` strings, so a wording change in the reasoning
 * layer can never silently break recommendation generation.
 */
@Injectable()
export class RecommendationEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reasoning: ReasoningEngineService,
  ) {}

  async generate(
    organizationId: string,
    branchId?: string,
    categories: ReasoningCategory[] = ALL_CATEGORIES,
  ): Promise<AiRecommendation[]> {
    const insights = await Promise.all(
      categories.map((category) => this.reasoning.analyze(organizationId, category, branchId)),
    );

    const candidates = insights.flatMap((insight) => this.toCandidates(insight));
    if (candidates.length === 0) {
      return [];
    }

    return Promise.all(
      candidates.map((candidate) =>
        this.prisma.aiRecommendation.create({
          data: {
            organizationId,
            branchId: branchId ?? undefined,
            title: candidate.title,
            description: candidate.description,
            impact: candidate.impact,
            confidence: candidate.confidence,
            priority: candidate.priority,
          },
        }),
      ),
    );
  }

  private toCandidates(insight: AiInsight): RecommendationCandidate[] {
    const result = insight.content as unknown as ReasoningResult;
    if (result.causes.length === 0) {
      return [];
    }

    switch (result.signals.kind) {
      case "inventory":
        return this.inventoryCandidates(result.signals.lowStock, result.confidence);
      case "sales":
        return this.salesCandidates(result.signals.trend, result.confidence);
      case "customer":
        return this.customerCandidates(result.signals.trend, result.confidence);
      case "operational":
        return this.operationalCandidates(result.signals.events, result.problem, result.confidence);
      default:
        return [];
    }
  }

  private inventoryCandidates(
    lowStock: Extract<ReasoningResult["signals"], { kind: "inventory" }>["lowStock"],
    confidence: number,
  ): RecommendationCandidate[] {
    return lowStock.map((item) => {
      const deficitPct =
        item.reorderThreshold > 0 ? (1 - item.currentStock / item.reorderThreshold) * 100 : 100;
      return {
        title: `Reorder ${item.name}`,
        description: `${item.name} is at ${item.currentStock} units, below its reorder threshold of ${item.reorderThreshold}. Place a purchase order to avoid a stockout.`,
        impact: `Avoid stockout of ${item.name} (currently ${Math.max(0, Math.round(deficitPct))}% under threshold)`,
        confidence,
        priority: priorityFor(confidence, item.currentStock <= 0),
      };
    });
  }

  private salesCandidates(
    trend: Extract<ReasoningResult["signals"], { kind: "sales" }>["trend"],
    confidence: number,
  ): RecommendationCandidate[] {
    const demandDriven = Math.abs(trend.orderChangePct - trend.revenueChangePct) < 5;
    if (demandDriven) {
      return [
        {
          title: "Launch a promotional campaign to recover lost order volume",
          description: `Order volume fell ${Math.abs(trend.orderChangePct).toFixed(1)}% alongside a ${Math.abs(trend.revenueChangePct).toFixed(1)}% revenue decline — this looks demand-side, not pricing-related.`,
          impact: `Recover a share of the ${Math.abs(trend.revenueChangePct).toFixed(1)}% revenue decline`,
          confidence,
          priority: priorityFor(confidence, Math.abs(trend.revenueChangePct) >= 25),
        },
      ];
    }

    return [
      {
        title: "Review recent discounting and pricing changes",
        description: `Order volume held roughly steady (${trend.orderChangePct.toFixed(1)}%) while revenue fell ${Math.abs(trend.revenueChangePct).toFixed(1)}% — average order value dropped.`,
        impact: `Recover average order value, worth ~${Math.abs(trend.currentRevenue - trend.previousRevenue)} in the last 7 days`,
        confidence,
        priority: priorityFor(confidence, Math.abs(trend.revenueChangePct) >= 25),
      },
    ];
  }

  private customerCandidates(
    trend: Extract<ReasoningResult["signals"], { kind: "customer" }>["trend"],
    confidence: number,
  ): RecommendationCandidate[] {
    const candidates: RecommendationCandidate[] = [];
    if (trend.customerChangePct <= -10) {
      candidates.push({
        title: "Re-engage lapsed customers with a loyalty or win-back campaign",
        description: `Distinct customers fell ${Math.abs(trend.customerChangePct).toFixed(1)}% over the last 7 days (${trend.currentCustomers} vs ${trend.previousCustomers}).`,
        impact: `Recover a share of the ${Math.abs(trend.customerChangePct).toFixed(1)}% customer decline`,
        confidence,
        priority: priorityFor(confidence, Math.abs(trend.customerChangePct) >= 25),
      });
    }
    if (trend.repeatChangePct <= -10) {
      candidates.push({
        title: "Investigate the drop in repeat-order rate",
        description: `Orders per customer fell ${Math.abs(trend.repeatChangePct).toFixed(1)}% over the last 7 days — existing customers are ordering less often.`,
        impact: "Improve customer retention and lifetime value",
        confidence,
        priority: priorityFor(confidence, Math.abs(trend.repeatChangePct) >= 25),
      });
    }
    return candidates;
  }

  private operationalCandidates(
    events: Extract<ReasoningResult["signals"], { kind: "operational" }>["events"],
    problem: string,
    confidence: number,
  ): RecommendationCandidate[] {
    if (events.length === 0) {
      return [];
    }
    return [
      {
        title: "Review recent operational events",
        description: `${problem}: ${events.map((e) => e.memoryType).join(", ")}.`,
        impact: "Prevent a recorded operational issue from recurring",
        confidence,
        priority: priorityFor(
          confidence,
          events.some((e) => e.importance >= 0.85),
        ),
      },
    ];
  }
}
