import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { AiAuthorizationGuard } from "./ai-authorization.guard";

function makeContext(headers: Record<string, string>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as never;
}

describe("AiAuthorizationGuard", () => {
  it("allows the request through when the endpoint has no @RequireAiAuthorization metadata", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new AiAuthorizationGuard(reflector);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it("throws when the endpoint requires authorization and the header is missing", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new AiAuthorizationGuard(reflector);
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it("allows the request through when x-ai-action-confirmed is 'true'", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new AiAuthorizationGuard(reflector);
    expect(guard.canActivate(makeContext({ "x-ai-action-confirmed": "true" }))).toBe(true);
  });
});
