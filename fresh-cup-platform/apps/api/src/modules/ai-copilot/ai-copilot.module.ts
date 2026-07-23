import { Module } from "@nestjs/common";
import { IpAllowlistModule } from "../../enterprise/ip-allowlist/ip-allowlist.module";
import { TenancyModule } from "../../enterprise/tenancy/tenancy.module";
import { AiBrainModule } from "../ai-brain/ai-brain.module";
import { IntelligenceModule } from "../intelligence/intelligence.module";
import { AiCopilotController } from "./controllers/ai-copilot.controller";
import { AiCopilotScopeService } from "./services/ai-copilot-scope.service";
import { AnomalyDetectionService } from "./services/anomaly-detection.service";
import { BusinessHealthService } from "./services/business-health.service";
import { ExecutiveBriefingService } from "./services/executive-briefing.service";
import { ExecutiveDashboardService } from "./services/executive-dashboard.service";
import { ExecutiveSummaryService } from "./services/executive-summary.service";
import { RecommendationPriorityService } from "./services/recommendation-priority.service";

/**
 * Phase 9 Task 2 — AI CEO Copilot. Layers on top of the AI Brain
 * (`modules/ai-brain`, Phase 9 Task 1) and the Phase 6 Executive BI /
 * Inventory Intelligence services (`modules/intelligence`) — see each
 * service's own docblock for exactly what it reuses versus what it
 * genuinely computes fresh. Imports TenancyModule + IpAllowlistModule for
 * TenantContextGuard, the same pattern AiBrainModule itself uses (see
 * that module's docblock for why both are needed together).
 */
@Module({
  imports: [TenancyModule, IpAllowlistModule, AiBrainModule, IntelligenceModule],
  controllers: [AiCopilotController],
  providers: [
    AiCopilotScopeService,
    BusinessHealthService,
    AnomalyDetectionService,
    ExecutiveBriefingService,
    RecommendationPriorityService,
    ExecutiveDashboardService,
    ExecutiveSummaryService,
  ],
})
export class AiCopilotModule {}
