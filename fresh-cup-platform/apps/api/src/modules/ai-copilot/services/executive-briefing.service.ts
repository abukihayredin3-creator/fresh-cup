import { Injectable } from "@nestjs/common";
import { AiPriority, type ExecutiveBriefing, type Prisma } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import { RecommendationEngineService } from "../../ai-brain/services/recommendation-engine.service";
import { startOfDay, toDateKey } from "../../ai-brain/services/trend-statistics.util";
import type { ExecutiveOverviewDto } from "../../intelligence/executive/dto/executive-overview.dto";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import type { InventoryIntelligenceItemDto } from "../../intelligence/inventory-intelligence/dto/inventory-intelligence-item.dto";
import { InventoryIntelligenceService } from "../../intelligence/inventory-intelligence/inventory-intelligence.service";
import { AiCopilotScopeService } from "./ai-copilot-scope.service";
import { AnomalyDetectionService } from "./anomaly-detection.service";

const WINDOW_DAYS = 7;
const TOP_BOTTOM_COUNT = 5;
const INVENTORY_ALERT_LIMIT = 5;
/** A day counts as "above-average demand" once revenue clears the window average by this margin. */
const DEMAND_ABOVE_AVERAGE_MULTIPLIER = 1.1;
/** A day counts as "below-average staffing" once shift coverage falls this far under the window average. */
const STAFFING_BELOW_AVERAGE_MULTIPLIER = 0.7;

interface StaffingAlert {
  date: string;
  dayOfWeek: string;
  scheduledShifts: number;
  message: string;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const RISK_RANK: Record<AiPriority, number> = {
  [AiPriority.CRITICAL]: 4,
  [AiPriority.HIGH]: 3,
  [AiPriority.MEDIUM]: 2,
  [AiPriority.LOW]: 1,
};

/**
 * Feature 1 — the morning executive briefing. Assembles, never
 * recomputes: revenue/profit/top-bottom products come from
 * ExecutiveService.overview (Phase 6), inventory alerts from
 * InventoryIntelligenceService (Phase 6), AI recommendations from the AI
 * Brain's RecommendationEngineService (Phase 9 Task 1), and risk level
 * from AnomalyDetectionService (this module). Staffing alerts are the one
 * genuinely new computation here — demand (ExecutiveService's own
 * revenueTrend) versus shift coverage, day by day.
 */
@Injectable()
export class ExecutiveBriefingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AiCopilotScopeService,
    private readonly executive: ExecutiveService,
    private readonly inventoryIntelligence: InventoryIntelligenceService,
    private readonly recommendation: RecommendationEngineService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  async generateBriefing(
    actor: RequestUser,
    organizationId: string,
    branchId?: string,
  ): Promise<ExecutiveBriefing> {
    const branchIds = await this.scope.resolveBranches(actor, organizationId, branchId);

    const [perBranch, alerts, recommendations] = await Promise.all([
      Promise.all(branchIds.map((id) => this.briefingForBranch(actor, id))),
      this.anomalyDetection.detect(actor, organizationId, branchId),
      this.recommendation.generate(organizationId, branchId),
    ]);

    const revenueSummary = {
      currentRevenue: perBranch.reduce((sum, b) => sum + b.overview.totalRevenue, 0),
    };
    const profitSummary = {
      currentProfit: perBranch.reduce((sum, b) => sum + b.overview.totalEstimatedProfit, 0),
    };
    const topProducts = perBranch
      .flatMap((b) => b.overview.productProfitability)
      .sort((a, b) => b.estimatedMargin - a.estimatedMargin)
      .slice(0, TOP_BOTTOM_COUNT);
    const bottomProducts = perBranch
      .flatMap((b) => b.overview.productProfitability)
      .sort((a, b) => a.estimatedMargin - b.estimatedMargin)
      .slice(0, TOP_BOTTOM_COUNT);
    const inventoryAlerts = perBranch
      .flatMap((b) => b.inventoryAlerts)
      .slice(0, INVENTORY_ALERT_LIMIT);
    const staffingAlerts = perBranch.flatMap((b) => b.staffingAlerts);

    const riskLevel = this.resolveRiskLevel(alerts.map((a) => a.severity));
    const confidenceScore = this.resolveConfidence(recommendations.map((r) => r.confidence));

    return this.prisma.executiveBriefing.create({
      data: {
        organizationId,
        branchId: branchId ?? undefined,
        briefingDate: startOfDay(new Date()),
        revenueSummary: revenueSummary as unknown as Prisma.InputJsonValue,
        profitSummary: profitSummary as unknown as Prisma.InputJsonValue,
        topProducts: topProducts as unknown as Prisma.InputJsonValue,
        bottomProducts: bottomProducts as unknown as Prisma.InputJsonValue,
        inventoryAlerts: inventoryAlerts as unknown as Prisma.InputJsonValue,
        staffingAlerts: staffingAlerts as unknown as Prisma.InputJsonValue,
        aiRecommendations: recommendations.map((r) => ({
          title: r.title,
          description: r.description,
          impact: r.impact,
          confidence: r.confidence,
          priority: r.priority,
        })) as unknown as Prisma.InputJsonValue,
        riskLevel,
        confidenceScore,
      },
    });
  }

  private async briefingForBranch(
    actor: RequestUser,
    branchId: string,
  ): Promise<{
    overview: ExecutiveOverviewDto;
    inventoryAlerts: InventoryIntelligenceItemDto[];
    staffingAlerts: StaffingAlert[];
  }> {
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [overview, inventory] = await Promise.all([
      // Full ISO timestamps, not date-only strings — a date-only `to` parses to that
      // day's UTC midnight and would silently exclude everything from earlier today.
      this.executive.overview(actor, {
        branchId,
        from: start.toISOString(),
        to: end.toISOString(),
      }),
      this.inventoryIntelligence.intelligence(branchId),
    ]);

    const staffingAlerts = await this.staffingAlerts(branchId, overview, start, end);

    return {
      overview,
      inventoryAlerts: inventory
        .filter((item) => item.daysUntilStockout !== null)
        .slice(0, INVENTORY_ALERT_LIMIT),
      staffingAlerts,
    };
  }

  private async staffingAlerts(
    branchId: string,
    overview: ExecutiveOverviewDto,
    start: Date,
    end: Date,
  ): Promise<StaffingAlert[]> {
    if (overview.revenueTrend.length === 0) {
      return [];
    }

    const shifts = await this.prisma.shift.findMany({
      where: { branchId, startsAt: { gte: start, lte: end } },
      select: { startsAt: true },
    });

    const shiftCountByDate = new Map<string, number>();
    for (const shift of shifts) {
      const key = toDateKey(shift.startsAt);
      shiftCountByDate.set(key, (shiftCountByDate.get(key) ?? 0) + 1);
    }

    const avgRevenue = average(overview.revenueTrend.map((p) => p.revenue));
    const avgShiftCount = average(Array.from(shiftCountByDate.values()));
    if (avgShiftCount === 0) {
      return [];
    }

    const alerts: StaffingAlert[] = [];
    for (const point of overview.revenueTrend) {
      const scheduledShifts = shiftCountByDate.get(point.date) ?? 0;
      const aboveAverageDemand = point.revenue > avgRevenue * DEMAND_ABOVE_AVERAGE_MULTIPLIER;
      const belowAverageStaffing =
        scheduledShifts < avgShiftCount * STAFFING_BELOW_AVERAGE_MULTIPLIER;
      if (aboveAverageDemand && belowAverageStaffing) {
        const dayOfWeek = new Date(point.date).toLocaleDateString("en-US", { weekday: "long" });
        alerts.push({
          date: point.date,
          dayOfWeek,
          scheduledShifts,
          message: `${dayOfWeek} (${point.date}) had above-average demand but only ${scheduledShifts} shift(s) scheduled — review staffing`,
        });
      }
    }
    return alerts;
  }

  private resolveRiskLevel(severities: AiPriority[]): AiPriority {
    if (severities.length === 0) {
      return AiPriority.LOW;
    }
    return severities.reduce((worst, current) =>
      RISK_RANK[current] > RISK_RANK[worst] ? current : worst,
    );
  }

  private resolveConfidence(confidences: number[]): number {
    // No open recommendations to weigh in on: the briefing is still built
    // entirely from real aggregate data, so a moderate baseline confidence
    // (not a fabricated 1.0) rather than 0.
    return confidences.length > 0 ? Math.round(average(confidences) * 100) / 100 : 0.7;
  }
}
