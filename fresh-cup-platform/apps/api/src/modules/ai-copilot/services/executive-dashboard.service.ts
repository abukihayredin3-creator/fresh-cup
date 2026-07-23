import { Injectable } from "@nestjs/common";
import { ExecutiveAlertStatus } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { PredictionMetric } from "../../ai-brain/interfaces/ai-brain.interfaces";
import { DecisionEngineService } from "../../ai-brain/services/decision-engine.service";
import { PredictionEngineService } from "../../ai-brain/services/prediction-engine.service";
import type { ExecutiveOverviewDto } from "../../intelligence/executive/dto/executive-overview.dto";
import { ExecutiveService } from "../../intelligence/executive/executive.service";
import type {
  ExecutiveDashboardOverview,
  ExecutiveDashboardResult,
} from "../interfaces/executive-dashboard.interface";
import { AiCopilotScopeService } from "./ai-copilot-scope.service";
import { BusinessHealthService } from "./business-health.service";
import { RecommendationPriorityService } from "./recommendation-priority.service";

const WINDOW_DAYS = 7;
const PREDICTION_METRICS: PredictionMetric[] = ["sales", "inventory_demand", "customer_demand"];
const RECOMMENDATION_LIMIT = 10;
const PRIORITY_ACTION_LIMIT = 5;
const ACTIVE_ALERT_LIMIT = 20;

/**
 * Feature 4 — the single "everything an executive needs" payload. Every
 * section is assembled from an existing service's output, never
 * recomputed here: overview/KPIs from ExecutiveService.overview (Phase
 * 6), health score from BusinessHealthService (this module), active
 * alerts read from persisted ExecutiveAlert rows (AnomalyDetectionService
 * — via the `alerts` endpoint or ExecutiveBriefingService — is what
 * creates them; the dashboard just reads current state, matching its GET
 * semantics), AI recommendations from RecommendationPriorityService (this
 * module), predictions from the AI Brain's PredictionEngineService (Phase
 * 9 Task 1), and priority actions from the AI Brain's
 * DecisionEngineService (Phase 9 Task 1).
 */
@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AiCopilotScopeService,
    private readonly executive: ExecutiveService,
    private readonly businessHealth: BusinessHealthService,
    private readonly recommendationPriority: RecommendationPriorityService,
    private readonly prediction: PredictionEngineService,
    private readonly decision: DecisionEngineService,
  ) {}

  async getDashboard(
    actor: RequestUser,
    organizationId: string,
    branchId?: string,
  ): Promise<ExecutiveDashboardResult> {
    const branchIds = await this.scope.resolveBranches(actor, organizationId, branchId);
    const end = new Date();
    const start = new Date(end.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [overviews, healthScore, activeAlerts, aiRecommendations, predictions, decisions] =
      await Promise.all([
        // Full ISO timestamps, not date-only strings — a date-only `to` parses to that
        // day's UTC midnight and would silently exclude everything from earlier today.
        Promise.all(
          branchIds.map((id) =>
            this.executive.overview(actor, {
              branchId: id,
              from: start.toISOString(),
              to: end.toISOString(),
            }),
          ),
        ),
        this.businessHealth.computeHealth(actor, organizationId, branchId),
        this.prisma.executiveAlert.findMany({
          where: {
            organizationId,
            branchId: branchId ?? undefined,
            status: ExecutiveAlertStatus.ACTIVE,
          },
          orderBy: { createdAt: "desc" },
          take: ACTIVE_ALERT_LIMIT,
        }),
        this.recommendationPriority.rank(actor, organizationId, branchId),
        Promise.all(
          branchIds.flatMap((id) =>
            PREDICTION_METRICS.map((metric) =>
              this.prediction.predict({ organizationId, branchId: id, metric }),
            ),
          ),
        ),
        this.decision.decide(organizationId, branchId),
      ]);

    const overview = this.mergeOverviews(overviews);

    return {
      overview,
      kpis: this.buildKpis(overview),
      healthScore,
      activeAlerts,
      aiRecommendations: aiRecommendations.slice(0, RECOMMENDATION_LIMIT),
      predictions,
      priorityActions: decisions.slice(0, PRIORITY_ACTION_LIMIT),
    };
  }

  private mergeOverviews(overviews: ExecutiveOverviewDto[]): ExecutiveDashboardOverview {
    const totalRevenue = overviews.reduce((sum, o) => sum + o.totalRevenue, 0);
    const totalEstimatedProfit = overviews.reduce((sum, o) => sum + o.totalEstimatedProfit, 0);
    const totalCartsCreated = overviews.reduce(
      (sum, o) => sum + o.conversionMetrics.cartsCreated,
      0,
    );
    const totalOrdersPlaced = overviews.reduce(
      (sum, o) => sum + o.conversionMetrics.ordersPlaced,
      0,
    );
    const repeatCustomerRate =
      overviews.length > 0
        ? overviews.reduce((sum, o) => sum + o.repeatCustomerRate, 0) / overviews.length
        : 0;

    return {
      totalRevenue,
      totalEstimatedProfit,
      repeatCustomerRate: Math.round(repeatCustomerRate * 1000) / 1000,
      conversionRate:
        totalCartsCreated > 0
          ? Math.round((totalOrdersPlaced / totalCartsCreated) * 1000) / 1000
          : 0,
    };
  }

  private buildKpis(overview: ExecutiveDashboardOverview) {
    return [
      { label: "Revenue (7d)", value: overview.totalRevenue },
      { label: "Estimated profit (7d)", value: overview.totalEstimatedProfit },
      { label: "Repeat customer rate", value: overview.repeatCustomerRate },
      { label: "Cart-to-order conversion rate", value: overview.conversionRate },
    ];
  }
}
