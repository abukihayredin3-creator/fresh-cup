import type { Request, Response } from "express";
import { RequestContextService } from "./request-context";
import { RequestContextMiddleware } from "./request-context.middleware";

describe("RequestContextMiddleware", () => {
  function makeReqRes(inboundTraceId?: string) {
    const headers: Record<string, string> = {};
    const req = {
      header: jest.fn().mockReturnValue(inboundTraceId),
    } as unknown as Request;
    const res = {
      setHeader: jest.fn((name: string, value: string) => {
        headers[name] = value;
      }),
    } as unknown as Response;
    return { req, res, headers };
  }

  it("generates a new traceId when no inbound header is present", () => {
    const requestContext = new RequestContextService();
    const middleware = new RequestContextMiddleware(requestContext);
    const { req, res, headers } = makeReqRes(undefined);

    const next = jest.fn(() => {
      expect(requestContext.getTraceId()).toBe(headers["x-trace-id"]);
    });
    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    const traceId = headers["x-trace-id"];
    expect(traceId).toEqual(expect.any(String));
    expect(traceId!.length).toBeGreaterThan(0);
  });

  it("propagates an inbound x-trace-id header instead of generating a new one", () => {
    const requestContext = new RequestContextService();
    const middleware = new RequestContextMiddleware(requestContext);
    const { req, res, headers } = makeReqRes("inbound-trace-id");

    middleware.use(req, res, () => undefined);

    expect(headers["x-trace-id"]).toBe("inbound-trace-id");
  });
});
