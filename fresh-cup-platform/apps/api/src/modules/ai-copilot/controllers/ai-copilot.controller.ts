import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type {
  BusinessHealthSnapshot,
  ExecutiveAlert,
  ExecutiveBriefing,
  ExecutiveSummary,
} from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CurrentOrganization } from "../../../enterprise/tenancy/current-organization.decorator";
import { TenantContextGuard } from "../../../enterprise/tenancy/tenant-context.guard";
import { BranchScopeQueryDto } from "../dto/branch-scope-query.dto";
import { SummaryQueryDto } from "../dto/summary-query.dto";
import type { PriorityRecommendation } from "../interfaces/ai-copilot.interfaces";
import type { ExecutiveDashboardResult } from "../interfaces/executive-dashboard.interface";
import { AnomalyDetectionService } from "../services/anomaly-detection.service";
import { BusinessHealthService } from "../services/business-health.service";
import { ExecutiveBriefingService } from "../services/executive-briefing.service";
import { ExecutiveDashboardService } from "../services/executive-dashboard.service";
import { ExecutiveSummaryService } from "../services/executive-summary.service";
import { RecommendationPriorityService } from "../services/recommendation-priority.service";

/**
 * Phase 9 Task 2 — AI CEO Copilot. Every handler resolves its organization
 * from TenantContextGuard (never a client-supplied id) and its branch
 * scope through AiCopilotScopeService (actor-role restriction + tenant
 * verification), so one tenant — or one manager's own branch — can never
 * read another's data. All six endpoints are GET (this module only reads
 * and assembles; the AI Brain underneath owns every actual mutation), but
 * several still create rows (a new BusinessHealthSnapshot per health
 * check, a new ExecutiveBriefing per briefing, ...), so they're tagged
 * `@Auditable(entityType, { auditReads: true })` — see
 * common/audit/auditable.decorator.ts for why that's an opt-in extension
 * rather than the default GET-is-never-audited behavior.
 */
@ApiTags("ai-copilot")
@ApiBearerAuth()
@Controller("ai-copilot")
@UseGuards(TenantContextGuard)
@Roles(UserRole.MANAGER, UserRole.ADMIN)
export class AiCopilotController {
  constructor(
    private readonly dashboard: ExecutiveDashboardService,
    private readonly briefing: ExecutiveBriefingService,
    private readonly health: BusinessHealthService,
    private readonly anomalyDetection: AnomalyDetectionService,
    private readonly recommendationPriority: RecommendationPriorityService,
    private readonly summary: ExecutiveSummaryService,
  ) {}

  @Get("dashboard")
  @ApiOperation({
    summary:
      "Single aggregated executive payload: overview, KPIs, health, alerts, AI recommendations, predictions, priority actions",
  })
  getDashboard(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Query() query: BranchScopeQueryDto,
  ): Promise<ExecutiveDashboardResult> {
    return this.dashboard.getDashboard(actor, organizationId, query.branchId);
  }

  @Get("briefing")
  @Auditable("ExecutiveBriefing", { auditReads: true })
  @ApiOperation({
    summary:
      "Morning executive briefing: revenue/profit, top/bottom products, inventory/staffing alerts, AI recommendations",
  })
  getBriefing(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Query() query: BranchScopeQueryDto,
  ): Promise<ExecutiveBriefing> {
    return this.briefing.generateBriefing(actor, organizationId, query.branchId);
  }

  @Get("health")
  @Auditable("BusinessHealthSnapshot", { auditReads: true })
  @ApiOperation({
    summary:
      "Weighted 0-100 business health score across Revenue/Profit/Inventory/Customer/Operations/Staff",
  })
  getHealth(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Query() query: BranchScopeQueryDto,
  ): Promise<BusinessHealthSnapshot> {
    return this.health.computeHealth(actor, organizationId, query.branchId);
  }

  @Get("alerts")
  @Auditable("ExecutiveAlert", { auditReads: true })
  @ApiOperation({
    summary:
      "Detect unusual business events (revenue drop, orders low, waste high, inventory mismatch, complaint spike)",
  })
  @ApiOkResponse({ isArray: true })
  getAlerts(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Query() query: BranchScopeQueryDto,
  ): Promise<ExecutiveAlert[]> {
    return this.anomalyDetection.detect(actor, organizationId, query.branchId);
  }

  @Get("recommendations")
  @ApiOperation({
    summary:
      "Ranked recommendations merged from the AI Brain, executive analytics, forecasts, and inventory",
  })
  @ApiOkResponse({ isArray: true })
  getRecommendations(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Query() query: BranchScopeQueryDto,
  ): Promise<PriorityRecommendation[]> {
    return this.recommendationPriority.rank(actor, organizationId, query.branchId);
  }

  @Get("summary")
  @Auditable("ExecutiveSummary", { auditReads: true })
  @ApiOperation({
    summary: "Concise, template-generated natural-language executive summary (no LLM)",
  })
  getSummary(
    @CurrentUser() actor: RequestUser,
    @CurrentOrganization() organizationId: string,
    @Query() query: SummaryQueryDto,
  ): Promise<ExecutiveSummary> {
    return this.summary.generateSummary(actor, organizationId, query.branchId, query.period);
  }
}
