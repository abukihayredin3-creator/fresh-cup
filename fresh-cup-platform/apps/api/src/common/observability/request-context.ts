import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

export interface RequestContextStore {
  traceId: string;
}

/**
 * Correlation-ID tracing: not full OpenTelemetry span propagation across
 * services (that would need the @opentelemetry/* SDK, a large new
 * dependency tree, plus a live collector this environment has no way to
 * exercise) — a documented scope decision. Every request gets a traceId
 * (from an inbound `x-trace-id` header, or generated) carried through
 * Node's AsyncLocalStorage so it reaches every log line and error
 * emitted while handling that request, and echoed back on the response.
 * `infra/observability/otel-collector-config.yaml` documents how a real
 * OTel Collector would ingest these same trace IDs from log shipping
 * until span-level instrumentation is added.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getTraceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }
}
