import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { validateEnv } from "./common/config/env.validation";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { AppThrottlerGuard } from "./common/guards/app-throttler.guard";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { ObservabilityModule } from "./common/observability/observability.module";
import { PrismaModule } from "./database/prisma.module";
import { EnterpriseModule } from "./enterprise/enterprise.module";
import { AiIntelligenceModule } from "./intelligence/ai-intelligence.module";
import { AddressesModule } from "./modules/addresses/addresses.module";
import { AiBrainModule } from "./modules/ai-brain/ai-brain.module";
import { AiCopilotModule } from "./modules/ai-copilot/ai-copilot.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { DeliveryOpsModule } from "./modules/delivery/delivery-ops.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { HealthModule } from "./modules/health/health.module";
import { IntelligenceModule } from "./modules/intelligence/intelligence.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { KitchenModule } from "./modules/kitchen/kitchen.module";
import { LoyaltyModule } from "./modules/loyalty/loyalty.module";
import { MarketingModule } from "./modules/marketing/marketing.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrderingModule } from "./modules/ordering/ordering.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PromotionsModule } from "./modules/promotions/promotions.module";
import { PurchasingModule } from "./modules/purchasing/purchasing.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { SecurityModule } from "./modules/security/security.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { UsersModule } from "./modules/users/users.module";
import { RedisModule } from "./redis/redis.module";
import { WebsocketsModule } from "./websockets/websockets.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [".env.local", ".env"],
    }),
    // Cross-cutting domain events (order.paid -> loyalty accrual/notifications,
    // etc.) — see common/events/order-events.ts for the full contract.
    EventEmitterModule.forRoot(),
    // Phase 6: powers the nightly forecast-regeneration job (see
    // modules/intelligence/forecasting/forecasting.scheduler.ts) — the only
    // scheduled/cron infrastructure in the codebase.
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 60 }]),
    ObservabilityModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    AiBrainModule,
    AiCopilotModule,
    BranchesModule,
    CatalogModule,
    InventoryModule,
    OrderingModule,
    PromotionsModule,
    LoyaltyModule,
    PaymentsModule,
    NotificationsModule,
    WebsocketsModule,
    KitchenModule,
    DeliveryOpsModule,
    PurchasingModule,
    AuditModule,
    AnalyticsModule,
    SettingsModule,
    EmployeesModule,
    MarketingModule,
    ReviewsModule,
    SecurityModule,
    IntelligenceModule,
    AiIntelligenceModule,
    EnterpriseModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
