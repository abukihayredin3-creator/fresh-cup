import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * Prometheus metrics — a small, purpose-built dependency (prom-client),
 * not a hand-rolled text-exposition-format writer: the wire format has
 * real edge cases (label escaping, histogram bucket cumulative counts)
 * this platform's "hand-roll unless it's a parser/crypto surface" rule
 * doesn't cover well, and every serious Prometheus deployment already
 * expects exactly this library's output.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new Registry();
  readonly httpRequestDuration: Histogram<"method" | "route" | "status_code">;
  readonly httpRequestsTotal: Counter<"method" | "route" | "status_code">;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: "fresh_cup_api_" });

    this.httpRequestDuration = new Histogram({
      name: "fresh_cup_api_http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: "fresh_cup_api_http_requests_total",
      help: "Total HTTP requests handled",
      labelNames: ["method", "route", "status_code"],
      registers: [this.registry],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }
}
