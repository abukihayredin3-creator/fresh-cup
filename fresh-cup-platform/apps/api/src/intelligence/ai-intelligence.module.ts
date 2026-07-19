import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IntelligenceModule } from "../modules/intelligence/intelligence.module";
import { PrismaService } from "../database/prisma.service";
import { AssistantAiController } from "./controllers/assistant-ai.controller";
import { AiMemoryController } from "./controllers/ai-memory.controller";
import { CustomerAiController } from "./controllers/customer-ai.controller";
import { DeliveryAiController } from "./controllers/delivery-ai.controller";
import { ExecutiveAiController } from "./controllers/executive-ai.controller";
import { InventoryAiController } from "./controllers/inventory-ai.controller";
import { KitchenAiController } from "./controllers/kitchen-ai.controller";
import { MarketingAiController } from "./controllers/marketing-ai.controller";
import { SalesAiController } from "./controllers/sales-ai.controller";
import { WorkforceAiController } from "./controllers/workforce-ai.controller";
import {
  EMBEDDING_PROVIDER_TOKEN,
  createEmbeddingProvider,
} from "./embeddings/embedding-provider.factory";
import { AiAuthorizationGuard } from "./guards/ai-authorization.guard";
import { SecretRedactionInterceptor } from "./interceptors/secret-redaction.interceptor";
import { LLM_PROVIDER_TOKEN, createLlmProvider } from "./llm/llm-provider.factory";
import { AiMemoryService } from "./memory/ai-memory.service";
import { RagService } from "./rag/rag.service";
import { AiDailyDigestScheduler } from "./scheduler/ai-daily-digest.scheduler";
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
import { VECTOR_PROVIDER_TOKEN, createVectorProvider } from "./vector/vector-provider.factory";
import { EmbeddingBackfillWorker } from "./workers/embedding-backfill.worker";

/**
 * Phase 7 — Restaurant Intelligence Platform. Sits alongside Phase 6's
 * IntelligenceModule (imported, not replaced) and wraps its services with
 * explanation/confidence/memory framing for the domains that overlap
 * (executive/sales/customer/inventory/marketing), while adding three
 * entirely new domains Phase 6 never covered (kitchen/delivery/workforce).
 * Also owns the provider-agnostic LLM/embedding/vector infrastructure
 * (llm/, embeddings/, vector/, rag/, memory/) every domain — and Phase 6's
 * own AiAssistantService, unaffected — can eventually build on.
 */
@Module({
  imports: [IntelligenceModule],
  controllers: [
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
  ],
  providers: [
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
  ],
})
export class AiIntelligenceModule {}
