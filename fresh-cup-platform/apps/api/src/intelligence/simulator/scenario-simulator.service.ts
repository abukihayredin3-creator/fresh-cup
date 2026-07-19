import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ExecutiveService } from "../../modules/intelligence/executive/executive.service";
import type { ScenarioInput, ScenarioProjection, ScenarioResult } from "./scenario-simulator.types";

// Documented heuristic constants — NOT fit from this restaurant's own historical
// data (no price-change experiment history exists to estimate real elasticity
// from). These are standard order-of-magnitude assumptions for food-service
// price/promo/staffing sensitivity, made explicit so a reader can judge (and
// override) them rather than trusting an opaque number.
const PRICE_ELASTICITY = -1.2; // % volume change per 1% price change
const PROMO_ELASTICITY = 1.8; // % volume lift per 1% discount offered
const STAFFING_THROUGHPUT_FACTOR = 0.3; // % order-volume gain per 1% more staffed hours
const LABOR_COST_SHARE_OF_REVENUE = 0.25; // used to estimate added labor cost against profit
const PROFIT_SENSITIVITY_MULTIPLIER = 1.5; // profit reacts more than revenue since costs are semi-fixed

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function projection(
  metric: ScenarioProjection["metric"],
  baseline: number,
  changePercent: number,
): ScenarioProjection {
  const projected = baseline * (1 + changePercent / 100);
  return {
    metric,
    baseline: round2(baseline),
    projected: round2(projected),
    changePercent: round2(changePercent),
  };
}

/**
 * Scenario Simulator ("what if") — Phase 11 Part 3. Read-only: it only
 * calls `ExecutiveService.overview()` for baselines and never writes
 * anything, so it's safe to call with any hypothetical input. The
 * elasticity model is a documented heuristic (see constants above), not a
 * model fit to this restaurant's own price-change history — this platform
 * has no such history to fit from. Every result says so via
 * `assumptions`, consistent with Explainable AI's "evidence" requirement.
 */
@Injectable()
export class ScenarioSimulatorService {
  constructor(private readonly executiveService: ExecutiveService) {}

  async simulate(actor: RequestUser, input: ScenarioInput): Promise<ScenarioResult> {
    const overview = await this.executiveService.overview(actor, { branchId: input.branchId });
    const baselineRevenueEtb = overview.totalRevenue / 100;
    const baselineProfitEtb = overview.totalEstimatedProfit / 100;
    const baselineOrders = overview.conversionMetrics.ordersPlaced;

    const { revenueChangePercent, ordersChangePercent, profitChangePercent, assumptions } =
      this.project(input);

    const projections: ScenarioProjection[] = [
      projection("revenue", baselineRevenueEtb, revenueChangePercent),
      projection("customers", baselineOrders, ordersChangePercent),
      projection("profit", baselineProfitEtb, profitChangePercent),
      projection("inventoryDemand", baselineOrders, ordersChangePercent),
    ];

    return {
      scenario: input,
      assumptions,
      projections,
      confidence: 0.35, // heuristic, not data-fit — deliberately capped below "high confidence"
      generatedAt: new Date().toISOString(),
    };
  }

  private project(input: ScenarioInput): {
    revenueChangePercent: number;
    ordersChangePercent: number;
    profitChangePercent: number;
    assumptions: string[];
  } {
    switch (input.type) {
      case "price_change": {
        const ordersChangePercent = input.magnitudePercent * PRICE_ELASTICITY;
        const revenueChangePercent = input.magnitudePercent + ordersChangePercent;
        return {
          ordersChangePercent,
          revenueChangePercent,
          profitChangePercent: revenueChangePercent * PROFIT_SENSITIVITY_MULTIPLIER,
          assumptions: [
            `Assumed price elasticity of demand: ${PRICE_ELASTICITY} (order volume falls ${Math.abs(PRICE_ELASTICITY)}% per 1% price increase).`,
            `Revenue change approximated as price% + volume% (first-order).`,
            `Profit assumed ${PROFIT_SENSITIVITY_MULTIPLIER}x more sensitive than revenue since most costs are semi-fixed.`,
          ],
        };
      }
      case "promotion": {
        const ordersChangePercent = input.magnitudePercent * PROMO_ELASTICITY;
        const revenueChangePercent = ordersChangePercent - input.magnitudePercent;
        return {
          ordersChangePercent,
          revenueChangePercent,
          profitChangePercent: revenueChangePercent * PROFIT_SENSITIVITY_MULTIPLIER,
          assumptions: [
            `Assumed promo elasticity: ${PROMO_ELASTICITY}% volume lift per 1% discount offered.`,
            `Revenue change nets the volume gain against the discount given up.`,
          ],
        };
      }
      case "staffing_change": {
        const ordersChangePercent = input.magnitudePercent * STAFFING_THROUGHPUT_FACTOR;
        const laborCostDrag = input.magnitudePercent * LABOR_COST_SHARE_OF_REVENUE;
        return {
          ordersChangePercent,
          revenueChangePercent: ordersChangePercent,
          profitChangePercent: ordersChangePercent - laborCostDrag,
          assumptions: [
            `Assumed ${STAFFING_THROUGHPUT_FACTOR * 100}% of a staffing-hours increase converts to order-volume capacity.`,
            `Added labor cost assumed at ${LABOR_COST_SHARE_OF_REVENUE * 100}% of the staffing change, applied against profit.`,
          ],
        };
      }
    }
  }
}
