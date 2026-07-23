import { Injectable } from "@nestjs/common";
import { HealthTrend, ShiftStatus, type BusinessHealthSnapshot } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { ReasoningResult } from "../../ai-brain/interfaces/ai-brain.interfaces";
import { ReasoningEngineService } from "../../ai-brain/services/reasoning-engine.service";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import { InventoryIntelligenceService } from "../../intelligence/inventory-intelligence/inventory-intelligence.service";
import { AiCopilotScopeService } from "./ai-copilot-scope.service";

const WINDOW_DAYS = 7;

/**
 * Weighted contribution of each category to the overall 0-100 score.
 * Revenue and profit carry the most weight (the two numbers an owner
 * checks first); staff is weighted lowest since ShiftStatus.MISSED is a
 * thinner signal than the others. Sums to 1.
 */
const CATEGORY_WEIGHTS = {
  revenue: 0.25,
  profit: 0.2,
  inventory: 0.15,
  customer: 0.15,
  operations: 0.15,
  staff: 0.1,
} as const;

/** A score swing smaller than this between snapshots reads as noise, not a real trend. */
const TREND_THRESHOLD = 3;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

interface CategoryScores {
  revenueScore: number;
  profitScore: number;
  inventoryScore: number;
  customerScore: number;
  operationsScore: number;
  staffScore: number;
}

/**
 * A single 0-100 "how is the business doing" number, broken down into
 * Revenue/Profit/Inventory/Customer/Operations/Staff — every category
 * score is derived from an existing service's real output (never
 * recomputed): ReasoningEngineService's sales/customer trend signals
 * (Phase 9 Task 1), ExecutiveService.overview's margin and conversion
 * rate (Phase 6), InventoryIntelligenceService's at-risk item list
 * (Phase 6). Staff is the one genuinely new signal (Shift no-show rate —
 * nothing else in the codebase computes it). The exact weights and
 * scaling factors below are a documented, rule-based heuristic, not a
 * trained model — consistent with Phase 9's "no fake AI" principle.
 */
@Injectable()
export class BusinessHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AiCopilotScopeService,
    private readonly reasoning: ReasoningEngineService,
    private readonly executive: ExecutiveService,
    private readonly inventoryIntelligence: InventoryIntelligenceService,
  ) {}

  async computeHealth(
    actor: RequestUser,
    organizationId: string,
    branchId?: string,
  ): Promise<BusinessHealthSnapshot> {
    const branchIds = await this.scope.resolveBranches(actor, organizationId, branchId);
    const perBranch =
      branchIds.length > 0
        ? await Promise.all(branchIds.map((id) => this.scoreForBranch(actor, organizationId, id)))
        : [this.emptyScores()];

    const revenueScore = clampScore(average(perBranch.map((s) => s.revenueScore)));
    const profitScore = clampScore(average(perBranch.map((s) => s.profitScore)));
    const inventoryScore = clampScore(average(perBranch.map((s) => s.inventoryScore)));
    const customerScore = clampScore(average(perBranch.map((s) => s.customerScore)));
    const operationsScore = clampScore(average(perBranch.map((s) => s.operationsScore)));
    const staffScore = clampScore(average(perBranch.map((s) => s.staffScore)));

    const overallScore = clampScore(
      revenueScore * CATEGORY_WEIGHTS.revenue +
        profitScore * CATEGORY_WEIGHTS.profit +
        inventoryScore * CATEGORY_WEIGHTS.inventory +
        customerScore * CATEGORY_WEIGHTS.customer +
        operationsScore * CATEGORY_WEIGHTS.operations +
        staffScore * CATEGORY_WEIGHTS.staff,
    );

    const trend = await this.resolveTrend(organizationId, branchId, overallScore);

    return this.prisma.businessHealthSnapshot.create({
      data: {
        organizationId,
        branchId: branchId ?? undefined,
        overallScore,
        revenueScore,
        profitScore,
        inventoryScore,
        customerScore,
        operationsScore,
        staffScore,
        trend,
      },
    });
  }

  private emptyScores(): CategoryScores {
    return {
      revenueScore: 0,
      profitScore: 0,
      inventoryScore: 0,
      customerScore: 0,
      operationsScore: 0,
      staffScore: 0,
    };
  }

  private async scoreForBranch(
    actor: RequestUser,
    organizationId: string,
    branchId: string,
  ): Promise<CategoryScores> {
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [
      salesInsight,
      customerInsight,
      overview,
      inventoryAlerts,
      totalActiveItems,
      missedRatio,
    ] = await Promise.all([
      this.reasoning.analyze(organizationId, "sales", branchId),
      this.reasoning.analyze(organizationId, "customer", branchId),
      // Full ISO timestamps, not date-only strings — ExecutiveService.resolveRange parses
      // `to` with `new Date(to)`, and a date-only string parses to that day's UTC midnight,
      // which would silently exclude everything from earlier today.
      this.executive.overview(actor, {
        branchId,
        from: start.toISOString(),
        to: end.toISOString(),
      }),
      this.inventoryIntelligence.intelligence(branchId),
      this.prisma.inventoryItem.count({ where: { branchId, isActive: true } }),
      this.staffMissedRatio(branchId, start, end),
    ]);

    const salesContent = salesInsight.content as unknown as ReasoningResult;
    const customerContent = customerInsight.content as unknown as ReasoningResult;
    const revenueChangePct =
      salesContent.signals.kind === "sales" ? salesContent.signals.trend.revenueChangePct : 0;
    const customerChangePct =
      customerContent.signals.kind === "customer"
        ? customerContent.signals.trend.customerChangePct
        : 0;

    const marginPct =
      overview.totalRevenue > 0 ? overview.totalEstimatedProfit / overview.totalRevenue : 0;
    const inventoryRatio = totalActiveItems > 0 ? inventoryAlerts.length / totalActiveItems : 0;

    return {
      // Baseline 70 (steady is a pass) + 1.5 points per percent of revenue swing.
      revenueScore: clampScore(70 + revenueChangePct * 1.5),
      // COGS-only margin; a 40% margin (healthy for a juice/food menu before labor/rent) reaches 100.
      profitScore: clampScore(marginPct * 250),
      // Every item flagged at-risk drags the score down proportionally to the active catalog size.
      inventoryScore: clampScore(100 - inventoryRatio * 100),
      // Baseline 50 + up to 50 from the repeat-customer rate + a trend adjustment.
      customerScore: clampScore(50 + overview.repeatCustomerRate * 50 + customerChangePct * 0.5),
      // A 50% cart->order conversion rate reaches 100.
      operationsScore: clampScore(overview.conversionMetrics.conversionRate * 200),
      staffScore: clampScore(100 - missedRatio * 100),
    };
  }

  private async staffMissedRatio(branchId: string, start: Date, end: Date): Promise<number> {
    const [missed, completed] = await Promise.all([
      this.prisma.shift.count({
        where: { branchId, status: ShiftStatus.MISSED, startsAt: { gte: start, lte: end } },
      }),
      this.prisma.shift.count({
        where: { branchId, status: ShiftStatus.COMPLETED, startsAt: { gte: start, lte: end } },
      }),
    ]);
    const total = missed + completed;
    // No shift history to evaluate against in this window — nothing observed wrong, so no penalty.
    return total > 0 ? missed / total : 0;
  }

  private async resolveTrend(
    organizationId: string,
    branchId: string | undefined,
    overallScore: number,
  ): Promise<HealthTrend> {
    const previous = await this.prisma.businessHealthSnapshot.findFirst({
      where: { organizationId, branchId: branchId ?? null },
      orderBy: { createdAt: "desc" },
      select: { overallScore: true },
    });
    if (!previous) {
      return HealthTrend.STABLE;
    }
    const diff = overallScore - previous.overallScore;
    if (diff >= TREND_THRESHOLD) {
      return HealthTrend.IMPROVING;
    }
    if (diff <= -TREND_THRESHOLD) {
      return HealthTrend.DECLINING;
    }
    return HealthTrend.STABLE;
  }
}
