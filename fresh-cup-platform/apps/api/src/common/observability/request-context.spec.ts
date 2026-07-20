import { RequestContextService } from "./request-context";

describe("RequestContextService", () => {
  it("returns undefined outside of a run() scope", () => {
    const service = new RequestContextService();
    expect(service.getTraceId()).toBeUndefined();
  });

  it("exposes the traceId set for the current run() scope", () => {
    const service = new RequestContextService();
    service.run({ traceId: "trace-123" }, () => {
      expect(service.getTraceId()).toBe("trace-123");
    });
  });

  it("isolates traceIds across concurrent async scopes", async () => {
    const service = new RequestContextService();
    const results: string[] = [];

    const runOne = () =>
      service.run({ traceId: "trace-A" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        results.push(service.getTraceId()!);
      });
    const runTwo = () =>
      service.run({ traceId: "trace-B" }, async () => {
        results.push(service.getTraceId()!);
      });

    await Promise.all([runOne(), runTwo()]);
    expect(results.sort()).toEqual(["trace-A", "trace-B"]);
  });
});
