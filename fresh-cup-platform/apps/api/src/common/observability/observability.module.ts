import { Global, MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { HttpMetricsInterceptor } from "./http-metrics.interceptor";
import { JsonLoggerService } from "./json-logger.service";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { RequestContextMiddleware } from "./request-context.middleware";
import { RequestContextService } from "./request-context";

/**
 * Health monitoring, metrics, and log aggregation primitives — see
 * `RequestContextService`'s docblock for the distributed-tracing scope
 * decision. `HealthModule` (Phase 1) already covers liveness/readiness;
 * this module adds the traceId propagation those health checks' logs
 * benefit from, plus `/metrics` for Prometheus scraping.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    RequestContextService,
    JsonLoggerService,
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [RequestContextService, JsonLoggerService, MetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
