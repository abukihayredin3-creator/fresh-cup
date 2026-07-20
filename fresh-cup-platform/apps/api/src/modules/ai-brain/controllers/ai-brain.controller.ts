import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type {
  AiDecision,
  AiInsight,
  AiLearningEvent,
  AiMemory,
  AiRecommendation,
} from "@prisma/client";
import type { PaginatedResult } from "@fresh-cup/types";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentOrganization } from "../../../enterprise/tenancy/current-organization.decorator";
import { TenantContextGuard } from "../../../enterprise/tenancy/tenant-context.guard";
import { AnalyzeRequestDto } from "../dto/analyze-request.dto";
import { DecisionRequestDto } from "../dto/decision-request.dto";
import { LearningFeedbackDto } from "../dto/learning-feedback.dto";
import { MemoryQueryDto } from "../dto/memory-query.dto";
import { RecommendRequestDto } from "../dto/recommend-request.dto";
import { AiBrainStatusResponseDto } from "../dto/status-response.dto";
import { AiBrainStatusService } from "../services/ai-brain-status.service";
import { DecisionEngineService } from "../services/decision-engine.service";
import { LearningEngineService } from "../services/learning-engine.service";
import { MemoryEngineService } from "../services/memory-engine.service";
import { ReasoningEngineService } from "../services/reasoning-engine.service";
import { RecommendationEngineService } from "../services/recommendation-engine.service";

/**
 * Phase 9 Task 1 — AI Restaurant Brain Core. Every handler resolves its
 * organization from TenantContextGuard (never a client-supplied id), so
 * one tenant can never read or act on another tenant's AI Brain state.
 * Mutating endpoints are `@Auditable` — AuditLogInterceptor (registered
 * globally in AuditModule) writes one AuditLog row per call.
 */
@ApiTags("ai-brain")
@ApiBearerAuth()
@Controller("ai-brain")
@UseGuards(TenantContextGuard)
@Roles(UserRole.MANAGER, UserRole.ADMIN)
export class AiBrainController {
  constructor(
    private readonly status: AiBrainStatusService,
    private readonly memory: MemoryEngineService,
    private readonly reasoning: ReasoningEngineService,
    private readonly recommendation: RecommendationEngineService,
    private readonly decision: DecisionEngineService,
    private readonly learning: LearningEngineService,
  ) {}

  @Get("status")
  @ApiOperation({ summary: "Overview of the AI Brain's current state for this organization" })
  @ApiOkResponse({ type: AiBrainStatusResponseDto })
  getStatus(@CurrentOrganization() organizationId: string): Promise<AiBrainStatusResponseDto> {
    return this.status.getStatus(organizationId);
  }

  @Get("memory")
  @ApiOperation({ summary: "Retrieve stored business events and AI observations" })
  getMemory(
    @CurrentOrganization() organizationId: string,
    @Query() query: MemoryQueryDto,
  ): Promise<PaginatedResult<AiMemory>> {
    return this.memory.recall(organizationId, query);
  }

  @Post("analyze")
  @Auditable("AiInsight")
  @ApiOperation({ summary: "Run the Reasoning Engine over real business data for one category" })
  analyze(
    @CurrentOrganization() organizationId: string,
    @Body() dto: AnalyzeRequestDto,
  ): Promise<AiInsight> {
    return this.reasoning.analyze(organizationId, dto.category, dto.branchId);
  }

  @Post("recommend")
  @Auditable("AiRecommendation")
  @ApiOperation({
    summary: "Generate ranked, actionable recommendations from the latest reasoning",
  })
  recommend(
    @CurrentOrganization() organizationId: string,
    @Body() dto: RecommendRequestDto,
  ): Promise<AiRecommendation[]> {
    return this.recommendation.generate(organizationId, dto.branchId, dto.categories);
  }

  @Post("decision")
  @Auditable("AiDecision")
  @ApiOperation({
    summary: "Combine predictions, reasoning, and ranked recommendations into executive actions",
  })
  decide(
    @CurrentOrganization() organizationId: string,
    @Body() dto: DecisionRequestDto,
  ): Promise<AiDecision[]> {
    return this.decision.decide(organizationId, dto.branchId);
  }

  @Post("learning")
  @Auditable("AiLearningEvent")
  @ApiOperation({ summary: "Record the outcome of a recommendation — the feedback loop" })
  recordLearning(
    @CurrentOrganization() organizationId: string,
    @Body() dto: LearningFeedbackDto,
  ): Promise<AiLearningEvent> {
    return this.learning.recordFeedback(organizationId, dto);
  }
}
