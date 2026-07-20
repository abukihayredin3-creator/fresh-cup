import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { IpAllowlistService } from "../ip-allowlist/ip-allowlist.service";
import { TenantContextGuard } from "./tenant-context.guard";
import type { TenantContextService } from "./tenant-context.service";

function makeContext(headers: Record<string, string>, ip: string) {
  const request = {
    headers,
    ip,
    user: { id: "u1" },
    organizationId: undefined as string | undefined,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("TenantContextGuard", () => {
  function makeGuard(allowed: boolean) {
    const tenantContext = {
      resolveOrganizationId: jest.fn().mockResolvedValue("org-1"),
    } as unknown as jest.Mocked<TenantContextService>;
    const ipAllowlist = {
      isAllowed: jest.fn().mockResolvedValue(allowed),
    } as unknown as jest.Mocked<IpAllowlistService>;
    return {
      guard: new TenantContextGuard(tenantContext, ipAllowlist),
      tenantContext,
      ipAllowlist,
    };
  }

  it("attaches the resolved organizationId when the IP is allowed", async () => {
    const { guard } = makeGuard(true);
    const { context, request } = makeContext({}, "203.0.113.5");
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.organizationId).toBe("org-1");
  });

  it("throws ForbiddenException when the IP is not allowed", async () => {
    const { guard, ipAllowlist } = makeGuard(false);
    const { context } = makeContext({}, "198.51.100.9");
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(ipAllowlist.isAllowed).toHaveBeenCalledWith("org-1", "198.51.100.9");
  });
});
