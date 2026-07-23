import { Module } from "@nestjs/common";
import { IpAllowlistModule } from "../../enterprise/ip-allowlist/ip-allowlist.module";
import { TenancyModule } from "../../enterprise/tenancy/tenancy.module";
import { AiBrainController } from "./controllers/ai-brain.controller";
import { AiBrainStatusService } from "./services/ai-brain-status.service";
import { AiBrainTenantScopeService } from "./services/ai-brain-tenant-scope.service";
import { DecisionEngineService } from "./services/decision-engine.service";
import { LearningEngineService } from "./services/learning-engine.service";
import { MemoryEngineService } from "./services/memory-engine.service";
import { PredictionEngineService } from "./services/prediction-engine.service";
import { ReasoningEngineService } from "./services/reasoning-engine.service";
import { RecommendationEngineService } from "./services/recommendation-engine.service";

/**
 * Phase 9 Task 1 — AI Restaurant Brain Core. A self-contained memory ->
 * reasoning -> prediction -> recommendation -> decision -> learning loop,
 * deliberately separate from the existing intelligence trees (Phase 6's
 * modules/intelligence, Phase 7/11's intelligence/, Phase 8's
 * enterprise/analytics) — see the schema.prisma docblock above AiInsight
 * for why this doesn't replace or duplicate them.
 *
 * Imports TenancyModule for TenantContextGuard, the same cross-tree
 * pattern BranchesModule already uses to resolve "which organization is
 * this request acting within" without pulling in all of EnterpriseModule.
 * Also imports IpAllowlistModule directly — TenantContextGuard depends on
 * IpAllowlistService, and (per EnterpriseModule's own imports list, the
 * only other place a controller uses this guard directly) a module using
 * the guard itself, not just TenantContextService, needs it alongside
 * TenancyModule.
 *
 * `AiBrainTenantScopeService` is exported (not just an internal provider)
 * so Phase 9 Task 2's ai-copilot module can import this module and reuse
 * the same branch-belongs-to-organization check rather than duplicating
 * it.
 */
@Module({
  imports: [TenancyModule, IpAllowlistModule],
  controllers: [AiBrainController],
  providers: [
    AiBrainTenantScopeService,
    AiBrainStatusService,
    MemoryEngineService,
    PredictionEngineService,
    ReasoningEngineService,
    RecommendationEngineService,
    DecisionEngineService,
    LearningEngineService,
  ],
  exports: [
    AiBrainTenantScopeService,
    MemoryEngineService,
    PredictionEngineService,
    ReasoningEngineService,
    RecommendationEngineService,
    DecisionEngineService,
    LearningEngineService,
  ],
})
export class AiBrainModule {}
