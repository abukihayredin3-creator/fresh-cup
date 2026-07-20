import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  it("exposes recorded HTTP request metrics in Prometheus exposition format", async () => {
    const service = new MetricsService();
    service.recordHttpRequest("GET", "/api/v1/health", 200, 0.05);

    const output = await service.metrics();
    expect(output).toContain("fresh_cup_api_http_requests_total");
    expect(output).toContain('method="GET"');
    expect(output).toContain('route="/api/v1/health"');
    expect(output).toContain('status_code="200"');
    expect(output).toContain("fresh_cup_api_http_request_duration_seconds");
  });

  it("includes default Node process metrics", async () => {
    const service = new MetricsService();
    const output = await service.metrics();
    expect(output).toContain("fresh_cup_api_process_cpu");
  });

  it("clears the registry on module destroy", () => {
    const service = new MetricsService();
    service.onModuleDestroy();
    expect(service.registry.getMetricsAsArray()).toEqual([]);
  });
});
