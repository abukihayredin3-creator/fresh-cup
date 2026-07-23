import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { lastValueFrom, of, throwError } from "rxjs";
import type { PrismaService } from "../../database/prisma.service";
import { AUDIT_ENTITY_TYPE_KEY, AUDIT_INCLUDE_READS_KEY } from "./auditable.decorator";
import { AuditLogInterceptor } from "./audit-log.interceptor";

function makeContext(options: {
  method: string;
  routePath?: string;
  path?: string;
  params?: Record<string, string>;
  user?: { id: string };
}): ExecutionContext {
  const request = {
    method: options.method,
    route: options.routePath ? { path: options.routePath } : undefined,
    path: options.path ?? "/api/v1/admin/whatever",
    params: options.params ?? {},
    user: options.user,
  };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeHandler(result: unknown): CallHandler {
  return { handle: () => of(result) };
}

describe("AuditLogInterceptor", () => {
  let interceptor: AuditLogInterceptor;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: { auditLog: { create: jest.Mock } };

  /** Configures the reflector as if `@Auditable(entityType, { auditReads })` were applied. */
  function tagWith(entityType: string | undefined, auditReads = false): void {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === AUDIT_ENTITY_TYPE_KEY) return entityType;
      if (key === AUDIT_INCLUDE_READS_KEY) return auditReads ? true : undefined;
      return undefined;
    });
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    interceptor = new AuditLogInterceptor(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
    );
  });

  it("skips untagged controllers entirely", async () => {
    tagWith(undefined);
    const context = makeContext({ method: "POST" });

    await lastValueFrom(interceptor.intercept(context, makeHandler({ id: "x" })));

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("skips non-mutating methods (GET) even on a tagged controller", async () => {
    tagWith("Widget");
    const context = makeContext({ method: "GET" });

    await lastValueFrom(interceptor.intercept(context, makeHandler({ id: "x" })));

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("writes an audit log with actor, action, entityType, and the response as after-state", async () => {
    tagWith("Widget");
    const context = makeContext({
      method: "POST",
      routePath: "/api/v1/admin/widgets",
      user: { id: "actor-1" },
    });

    await lastValueFrom(
      interceptor.intercept(context, makeHandler({ id: "widget-1", name: "Thing" })),
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "actor-1",
        action: "POST /api/v1/admin/widgets",
        entityType: "Widget",
        entityId: "widget-1",
        after: { id: "widget-1", name: "Thing" },
      },
    });
  });

  it("falls back to request.params.id and {deleted:true} for a DELETE with no body", async () => {
    tagWith("Widget");
    const context = makeContext({
      method: "DELETE",
      routePath: "/api/v1/admin/widgets/:id",
      params: { id: "widget-1" },
      user: { id: "actor-1" },
    });

    await lastValueFrom(interceptor.intercept(context, makeHandler(undefined)));

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entityId: "widget-1", after: { deleted: true } }),
    });
  });

  it("never fails the response even if the response stream itself errors", async () => {
    tagWith("Widget");
    const context = makeContext({ method: "POST" });
    const handler: CallHandler = {
      handle: () => throwError(() => new Error("downstream failure")),
    };

    await expect(lastValueFrom(interceptor.intercept(context, handler))).rejects.toThrow(
      "downstream failure",
    );
    // The interceptor never got a result to log — no audit write should have been attempted.
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not propagate an audit-log write failure back to the caller", async () => {
    tagWith("Widget");
    prisma.auditLog.create.mockRejectedValue(new Error("db down"));
    const context = makeContext({ method: "POST", user: { id: "actor-1" } });

    const result = await lastValueFrom(interceptor.intercept(context, makeHandler({ id: "x" })));

    expect(result).toEqual({ id: "x" });
  });

  it("audits a GET request when auditReads is opted in", async () => {
    tagWith("ExecutiveBriefing", true);
    const context = makeContext({
      method: "GET",
      routePath: "/api/v1/ai-copilot/briefing",
      user: { id: "actor-1" },
    });

    await lastValueFrom(interceptor.intercept(context, makeHandler({ id: "brief-1" })));

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "GET /api/v1/ai-copilot/briefing",
        entityType: "ExecutiveBriefing",
        entityId: "brief-1",
      }),
    });
  });

  it("still skips POST/PATCH/PUT/DELETE logic unaffected by auditReads on an unrelated GET", async () => {
    tagWith("Widget", false);
    const context = makeContext({ method: "GET" });

    await lastValueFrom(interceptor.intercept(context, makeHandler({ id: "x" })));

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
