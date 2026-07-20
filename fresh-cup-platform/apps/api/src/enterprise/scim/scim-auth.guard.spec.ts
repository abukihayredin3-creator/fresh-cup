import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { ScimAuthGuard } from "./scim-auth.guard";

function makeContext(headers: Record<string, string>) {
  const request = { headers, organizationId: undefined as string | undefined };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe("ScimAuthGuard", () => {
  function makeGuard(token: unknown) {
    const prisma = {
      scimToken: {
        findUnique: jest.fn().mockResolvedValue(token),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { guard: new ScimAuthGuard(prisma), prisma };
  }

  it("throws when the Authorization header is missing", async () => {
    const { guard } = makeGuard(null);
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws when the token doesn't match any ScimToken", async () => {
    const { guard } = makeGuard(null);
    const { context } = makeContext({ authorization: "Bearer bogus" });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws when the token has been revoked", async () => {
    const { guard } = makeGuard({ id: "tok-1", organizationId: "org-1", revokedAt: new Date() });
    const { context } = makeContext({ authorization: "Bearer validbutrevoked" });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("attaches organizationId and touches lastUsedAt for a valid token", async () => {
    const { guard, prisma } = makeGuard({ id: "tok-1", organizationId: "org-1", revokedAt: null });
    const { context, request } = makeContext({ authorization: "Bearer validtoken" });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.organizationId).toBe("org-1");
    expect(prisma.scimToken.update).toHaveBeenCalledWith({
      where: { id: "tok-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});
