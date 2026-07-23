import { Injectable } from "@nestjs/common";
import { AiPriority } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DecisionEngineService } from "../../ai-brain/services/decision-engine.service";
import { RecommendationEngineService } from "../../ai-brain/services/recommendation-engine.service";
import type { ExecutiveOverviewDto } from "../../intelligence/executive/dto/executive-overview.dto";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { InventoryIntelligenceService } from "../../intelligence/inventory-intelligence/inventory-intelligence.service";
import type { PriorityRecommendation } from "../interfaces/ai-copilot.interfaces";
import { AiCopilotScopeService } from "./ai-copilot-scope.service";

const WINDOW_DAYS = 7;
const INVENTORY_RECOMMENDATION_LIMIT = 3;

const PRIORITY_RANK: Record<AiPriority, number> = {
  [AiPriority.CRITICAL]: 4,
  [AiPriority.HIGH]: 3,
  [AiPriority.MEDIUM]: 2,
  [AiPriority.LOW]: 1,
};

/**
 * Merges and ranks recommendations from four sources without recomputing
 * any of them: the AI Brain's own RecommendationEngineService ("ai-brain"),
 * the AI Brain's DecisionEngineService filtered to its DEMAND_FORECAST
 * decisions ("forecast" — decide() already combines the Prediction and
 * Reasoning Engines, so this reads that instead of redoing the
 * forecast-vs-baseline comparison), ExecutiveService.overview's
 * marketing/waste figures ("executive-analytics" — data AI Brain doesn't
 * look at), and InventoryIntelligenceService's suggested reorders
 * ("inventory" — a richer, waste/expiry-aware signal than the AI Brain's
 * own reorder-threshold check). A read-only merge — nothing here is
 * persisted; each source's own engine already persists its own record.
 */
@Injectable()
export class RecommendationPriorityService {
  constructor(
    private readonly scope: AiCopilotScopeService,
    private readonly recommendation: RecommendationEngineService,
    private readonly decision: DecisionEngineService,
    private readonly executive: ExecutiveService,
    private readonly inventoryIntelligence: InventoryIntelligenceService,
  ) {}

  async rank(
    actor: RequestUser,
    organizationId: string,
    branchId?: string,
  ): Promise<PriorityRecommendation[]> {
    const branchIds = await this.scope.resolveBranches(actor, organizationId, branchId);

    const [aiBrainRecs, decisions, perBranchAnalytics] = await Promise.all([
      this.recommendation.generate(organizationId, branchId),
      this.decision.decide(organizationId, branchId),
      Promise.all(branchIds.map((id) => this.analyticsAndInventory(actor, id))),
    ]);

    const merged: PriorityRecommendation[] = [
      ...aiBrainRecs.map((rec) => ({
        source: "ai-brain" as const,
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        confidence: rec.confidence,
        priority: rec.priority,
      })),
      ...decisions
        .filter((d) => d.decisionType === "DEMAND_FORECAST")
        .map((d) => {
          const output = d.output as unknown as { action: string; reason: string };
          return {
            source: "forecast" as const,
            title: output.action,
            description: output.reason,
            impact: output.action,
            confidence: d.confidence,
            priority: d.priority,
          };
        }),
      ...perBranchAnalytics.flatMap((a) => a.executiveAnalytics),
      ...perBranchAnalytics.flatMap((a) => a.inventory),
    ];

    return merged.sort(
      (a, b) =>
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.confidence - a.confidence,
    );
  }

  private async analyticsAndInventory(
    actor: RequestUser,
    branchId: string,
  ): Promise<{
    executiveAnalytics: PriorityRecommendation[];
    inventory: PriorityRecommendation[];
  }> {
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Full ISO timestamps, not date-only strings — a date-only `to` parses to that
    // day's UTC midnight and would silently exclude everything from earlier today.
    const [overview, inventoryItems] = await Promise.all([
      this.executive.overview(actor, {
        branchId,
        from: start.toISOString(),
        to: end.toISOString(),
      }),
      this.inventoryIntelligence.intelligence(branchId),
    ]);

    return {
      executiveAnalytics: this.executiveAnalyticsRecommendations(overview),
      inventory: inventoryItems
        .filter((item) => item.suggestedReorderQuantity > 0)
        .sort((a, b) => (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity))
        .slice(0, INVENTORY_RECOMMENDATION_LIMIT)
        .map((item) => ({
          source: "inventory" as const,
          title: `Reorder ${item.name}`,
          description: `${item.suggestedReorderQuantity} unit(s) suggested to cover expected demand (waste probability ${Math.round(item.wasteProbability * 100)}%)`,
          impact: `Estimated cost ${item.suggestedReorderCost}`,
          confidence: 0.75,
          priority:
            item.daysUntilStockout !== null && item.daysUntilStockout <= 2
              ? AiPriority.CRITICAL
              : AiPriority.HIGH,
        })),
    };
  }

  private executiveAnalyticsRecommendations(
    overview: ExecutiveOverviewDto,
  ): PriorityRecommendation[] {
    const candidates: PriorityRecommendation[] = [];

    if (
      overview.marketingRoi.returnPerDiscountBirr !== null &&
      overview.marketingRoi.returnPerDiscountBirr < 2
    ) {
      candidates.push({
        source: "executive-analytics",
        title: "Review coupon/discount strategy",
        description: `Every 1 ETB of coupon discount returned only ${overview.marketingRoi.returnPerDiscountBirr} ETB in order revenue over the last ${WINDOW_DAYS} days`,
        impact: "Improve marketing return on discount spend",
        confidence: 0.7,
        priority: AiPriority.MEDIUM,
      });
    }

    if (
      overview.inventoryCosts.wasteCost > 0 &&
      overview.inventoryCosts.wasteCost > overview.inventoryCosts.purchasingSpend * 0.15
    ) {
      candidates.push({
        source: "executive-analytics",
        title: "Reduce inventory waste",
        description: `Waste cost (${overview.inventoryCosts.wasteCost}) is over 15% of purchasing spend (${overview.inventoryCosts.purchasingSpend}) over the last ${WINDOW_DAYS} days`,
        impact: "Recover a share of the waste cost",
        confidence: 0.7,
        priority: AiPriority.MEDIUM,
      });
    }

    return candidates;
  }
}
