import type { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";

describe("MetricsController", () => {
  it("returns the Prometheus exposition text from MetricsService", async () => {
    const metrics = {
      metrics: jest.fn().mockResolvedValue("fresh_cup_api_http_requests_total 1\n"),
    } as unknown as jest.Mocked<MetricsService>;
    const controller = new MetricsController(metrics);

    await expect(controller.scrape()).resolves.toContain("fresh_cup_api_http_requests_total");
  });
});
