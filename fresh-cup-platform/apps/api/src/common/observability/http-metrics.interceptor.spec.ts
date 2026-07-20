import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, throwError, type Observable } from "rxjs";
import type { MetricsService } from "./metrics.service";
import { HttpMetricsInterceptor } from "./http-metrics.interceptor";

function makeContext(options: { method: string; routePath?: string; path?: string }) {
  const request = {
    method: options.method,
    route: options.routePath ? { path: options.routePath } : undefined,
    path: options.path ?? "/api/v1/whatever",
  };
  const response = { statusCode: 200 };
  const context = {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, response };
}

function makeHandler(observable: Observable<unknown>): CallHandler {
  return { handle: () => observable };
}

describe("HttpMetricsInterceptor", () => {
  it("records a successful request with its route and status code", (done) => {
    const metrics = { recordHttpRequest: jest.fn() } as unknown as jest.Mocked<MetricsService>;
    const interceptor = new HttpMetricsInterceptor(metrics);
    const { context } = makeContext({ method: "GET", routePath: "/api/v1/branches/:id" });

    interceptor.intercept(context, makeHandler(of({ ok: true }))).subscribe({
      complete: () => {
        expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
          "GET",
          "/api/v1/branches/:id",
          200,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it("still records metrics when the handler throws", (done) => {
    const metrics = { recordHttpRequest: jest.fn() } as unknown as jest.Mocked<MetricsService>;
    const interceptor = new HttpMetricsInterceptor(metrics);
    const { context } = makeContext({ method: "POST", path: "/api/v1/orders" });

    interceptor.intercept(context, makeHandler(throwError(() => new Error("boom")))).subscribe({
      error: () => {
        expect(metrics.recordHttpRequest).toHaveBeenCalledWith(
          "POST",
          "/api/v1/orders",
          200,
          expect.any(Number),
        );
        done();
      },
    });
  });

  it("skips non-HTTP contexts (e.g. WebSocket) without touching metrics", (done) => {
    const metrics = { recordHttpRequest: jest.fn() } as unknown as jest.Mocked<MetricsService>;
    const interceptor = new HttpMetricsInterceptor(metrics);
    const context = { getType: () => "ws" } as unknown as ExecutionContext;

    interceptor.intercept(context, makeHandler(of({ ok: true }))).subscribe({
      complete: () => {
        expect(metrics.recordHttpRequest).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
