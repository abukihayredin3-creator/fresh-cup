import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { InventoryModule } from "../inventory/inventory.module";
import { AiAssistantController } from "./ai-assistant/ai-assistant.controller";
import { AiAssistantService } from "./ai-assistant/ai-assistant.service";
import { CustomerIntelligenceController } from "./customer-intelligence/customer-intelligence.controller";
import { CustomerIntelligenceService } from "./customer-intelligence/customer-intelligence.service";
import { ExecutiveController } from "./executive/executive.controller";
import { ExecutiveService } from "./executive/executive.service";
import { ForecastingController } from "./forecasting/forecasting.controller";
import { ForecastingScheduler } from "./forecasting/forecasting.scheduler";
import { ForecastingService } from "./forecasting/forecasting.service";
import { InventoryIntelligenceController } from "./inventory-intelligence/inventory-intelligence.controller";
import { InventoryIntelligenceService } from "./inventory-intelligence/inventory-intelligence.service";
import { MarketingIntelligenceController } from "./marketing-intelligence/marketing-intelligence.controller";
import { MarketingIntelligenceService } from "./marketing-intelligence/marketing-intelligence.service";
import { ModelRegistryService } from "./ml/model-registry.service";
import { RecommendationsController } from "./recommendations/recommendations.controller";
import { RecommendationsService } from "./recommendations/recommendations.service";

/**
 * Phase 6 — AI & Business Intelligence. One module for the whole bounded
 * context (recommendations, customer/inventory/marketing intelligence,
 * forecasting, executive BI, AI assistant) rather than nine separate Nest
 * modules — they share the ML primitives and cross-call each other
 * (MarketingIntelligenceService -> CustomerIntelligenceService,
 * ExecutiveController -> ForecastingService, AiAssistantService -> nearly
 * everything), so one module keeps that wiring direct instead of routing
 * through repeated imports/exports.
 */
@Module({
  imports: [AnalyticsModule, InventoryModule],
  controllers: [
    RecommendationsController,
    CustomerIntelligenceController,
    ForecastingController,
    InventoryIntelligenceController,
    MarketingIntelligenceController,
    ExecutiveController,
    AiAssistantController,
  ],
  providers: [
    ModelRegistryService,
    RecommendationsService,
    CustomerIntelligenceService,
    ForecastingService,
    ForecastingScheduler,
    InventoryIntelligenceService,
    MarketingIntelligenceService,
    ExecutiveService,
    AiAssistantService,
  ],
})
export class IntelligenceModule {}
