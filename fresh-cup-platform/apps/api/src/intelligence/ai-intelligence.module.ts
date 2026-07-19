import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IntelligenceModule } from "../modules/intelligence/intelligence.module";
import { CatalogModule } from "../modules/catalog/catalog.module";
import { MarketingModule } from "../modules/marketing/marketing.module";
import { PaymentsModule } from "../modules/payments/payments.module";
import { PromotionsModule } from "../modules/promotions/promotions.module";
import { PurchasingModule } from "../modules/purchasing/purchasing.module";
import { PrismaService } from "../database/prisma.service";
import { ApprovalExecutorRegistry } from "./approvals/approval-executor.registry";
import { ApprovalService } from "./approvals/approval.service";
import { ApprovalsController } from "./approvals/approvals.controller";
import { AgentsController } from "./agents/agents.controller";
import { CoordinatorAgentService } from "./agents/coordinator-agent.service";
import { DeliveryAgent } from "./agents/delivery.agent";
import { ExecutiveAgent } from "./agents/executive.agent";
import { FinanceAgent } from "./agents/finance.agent";
import { HrAgent } from "./agents/hr.agent";
import { InventoryAgent } from "./agents/inventory.agent";
import { KitchenAgent } from "./agents/kitchen.agent";
import { MarketingAgent } from "./agents/marketing.agent";
import { SalesAgent } from "./agents/sales.agent";
import { AssistantAiController } from "./controllers/assistant-ai.controller";
import { AiMemoryController } from "./controllers/ai-memory.controller";
import { CustomerAiController } from "./controllers/customer-ai.controller";
import { DeliveryAiController } from "./controllers/delivery-ai.controller";
import { DriftController } from "./controllers/drift.controller";
import { ExecutiveAiController } from "./controllers/executive-ai.controller";
import { ForecastController } from "./controllers/forecast.controller";
import { InventoryAiController } from "./controllers/inventory-ai.controller";
import { KitchenAiController } from "./controllers/kitchen-ai.controller";
import { MarketingAiController } from "./controllers/marketing-ai.controller";
import { ModelRegistryController } from "./controllers/model-registry.controller";
import { PredictionsController } from "./controllers/predictions.controller";
import { RetrainController } from "./controllers/retrain.controller";
import { SalesAiController } from "./controllers/sales-ai.controller";
import { SegmentationController } from "./controllers/segmentation.controller";
import { WorkforceAiController } from "./controllers/workforce-ai.controller";
import { ConfidenceCalibratorService } from "./calibration/confidence-calibrator.service";
import { DriftDetectionService } from "./drift/drift-detection.service";
import {
  EMBEDDING_PROVIDER_TOKEN,
  createEmbeddingProvider,
} from "./embeddings/embedding-provider.factory";
import { FeatureStoreService } from "./features/feature-store.service";
import { ForecastingFacadeService } from "./forecasting/forecasting-facade.service";
import { AiAuthorizationGuard } from "./guards/ai-authorization.guard";
import { SecretRedactionInterceptor } from "./interceptors/secret-redaction.interceptor";
import { LLM_PROVIDER_TOKEN, createLlmProvider } from "./llm/llm-provider.factory";
import { AiMemoryService } from "./memory/ai-memory.service";
import { CustomerPredictionService } from "./prediction/customer-prediction.service";
import { RagService } from "./rag/rag.service";
import { ModelRegistryV2Service } from "./registry/model-registry-v2.service";
import { AiDailyDigestScheduler } from "./scheduler/ai-daily-digest.scheduler";
import { KMeansClusteringStrategy } from "./segmentation/kmeans-clustering.strategy";
import { CustomerSegmentationService } from "./segmentation/customer-segmentation.service";
import { RuleBasedClusteringStrategy } from "./segmentation/rule-based-clustering.strategy";
import { AgentRunnerService } from "./services/agent-runner.service";
import { AiSecurityService } from "./services/ai-security.service";
import { AssistantAiService } from "./services/assistant-ai.service";
import { CustomerAiService } from "./services/customer-ai/customer-ai.service";
import { DeliveryAiService } from "./services/delivery-ai/delivery-ai.service";
import { ExecutiveAiService } from "./services/executive-ai/executive-ai.service";
import { ExplanationService } from "./services/explanation.service";
import { InventoryAiService } from "./services/inventory-ai/inventory-ai.service";
import { KitchenAiService } from "./services/kitchen-ai/kitchen-ai.service";
import { MarketingAiService } from "./services/marketing-ai/marketing-ai.service";
import { SalesAiService } from "./services/sales-ai/sales-ai.service";
import { WorkforceAiService } from "./services/workforce-ai/workforce-ai.service";
import { RetrainingScheduler } from "./training/retraining.scheduler";
import { RetrainingService } from "./training/retraining.service";
import { VECTOR_PROVIDER_TOKEN, createVectorProvider } from "./vector/vector-provider.factory";
import { EmbeddingBackfillWorker } from "./workers/embedding-backfill.worker";

/**
 * Phase 7 / Phase 11 — Restaurant Intelligence Platform. Sits alongside
 * Phase 6's IntelligenceModule (imported, not replaced) and wraps its
 * services with explanation/confidence/memory framing for the domains
 * that overlap (executive/sales/customer/inventory/marketing), while
 * adding domains Phase 6 never covered (kitchen/delivery/workforce) and,
 * in Part 2, a full Predictive Intelligence Platform on top: a feature
 * store, an explainable-prediction layer (8 customer models), a unified
 * forecast facade, configurable customer segmentation, confidence
 * calibration, drift detection, and an automatic retraining pipeline with
 * its own model registry. Also owns the provider-agnostic LLM/embedding/
 * vector infrastructure (llm/, embeddings/, vector/, rag/, memory/) every
 * domain — and Phase 6's own AiAssistantService, unaffected — can build on.
 */
@Module({
  imports: [
    IntelligenceModule,
    CatalogModule,
    PromotionsModule,
    MarketingModule,
    PaymentsModule,
    PurchasingModule,
  ],
  controllers: [
    ApprovalsController,
    AgentsController,
    ExecutiveAiController,
    SalesAiController,
    CustomerAiController,
    InventoryAiController,
    KitchenAiController,
    DeliveryAiController,
    MarketingAiController,
    WorkforceAiController,
    AiMemoryController,
    AssistantAiController,
    PredictionsController,
    ForecastController,
    ModelRegistryController,
    RetrainController,
    DriftController,
    SegmentationController,
  ],
  providers: [
    ApprovalService,
    ApprovalExecutorRegistry,
    SalesAgent,
    MarketingAgent,
    InventoryAgent,
    KitchenAgent,
    DeliveryAgent,
    FinanceAgent,
    HrAgent,
    ExecutiveAgent,
    CoordinatorAgentService,
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: createLlmProvider,
      inject: [ConfigService],
    },
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useFactory: createEmbeddingProvider,
      inject: [ConfigService],
    },
    {
      provide: VECTOR_PROVIDER_TOKEN,
      useFactory: createVectorProvider,
      inject: [ConfigService, PrismaService],
    },
    RagService,
    AiMemoryService,
    AiSecurityService,
    AgentRunnerService,
    ExplanationService,
    SecretRedactionInterceptor,
    AiAuthorizationGuard,
    ExecutiveAiService,
    SalesAiService,
    CustomerAiService,
    InventoryAiService,
    MarketingAiService,
    KitchenAiService,
    DeliveryAiService,
    WorkforceAiService,
    AssistantAiService,
    EmbeddingBackfillWorker,
    AiDailyDigestScheduler,
    FeatureStoreService,
    ModelRegistryV2Service,
    ConfidenceCalibratorService,
    DriftDetectionService,
    RuleBasedClusteringStrategy,
    KMeansClusteringStrategy,
    CustomerSegmentationService,
    CustomerPredictionService,
    ForecastingFacadeService,
    RetrainingService,
    RetrainingScheduler,
  ],
})
export class AiIntelligenceModule {}
