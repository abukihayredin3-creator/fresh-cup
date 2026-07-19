import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { OrgRolesGuard } from "./org-roles.guard";

function makeContext(user: { id: string; role: UserRole }, organizationId: string) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user, organizationId }) }),
  } as never;
}

describe("OrgRolesGuard", () => {
  function makeGuard(requiredRoles: unknown, membership: { role: string } | null) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
    const prisma = {
      organizationMembership: { findUnique: jest.fn().mockResolvedValue(membership) },
    } as unknown as jest.Mocked<PrismaService>;
    return { guard: new OrgRolesGuard(reflector, prisma), prisma };
  }

  it("allows the request through when no @OrgRoles metadata is set", async () => {
    const { guard } = makeGuard(undefined, null);
    await expect(
      guard.canActivate(makeContext({ id: "u1", role: UserRole.MANAGER }, "org-1")),
    ).resolves.toBe(true);
  });

  it("allows a platform ADMIN through without checking membership", async () => {
    const { guard, prisma } = makeGuard(["ORG_OWNER"], null);
    await expect(
      guard.canActivate(makeContext({ id: "u1", role: UserRole.ADMIN }, "org-1")),
    ).resolves.toBe(true);
    expect(prisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });

  it("throws when the actor has no membership in the organization", async () => {
    const { guard } = makeGuard(["ORG_OWNER"], null);
    await expect(
      guard.canActivate(makeContext({ id: "u1", role: UserRole.MANAGER }, "org-1")),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws when the membership's role isn't in the required list", async () => {
    const { guard } = makeGuard(["ORG_OWNER"], { role: "REGION_MANAGER" });
    await expect(
      guard.canActivate(makeContext({ id: "u1", role: UserRole.MANAGER }, "org-1")),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows the request through when the membership's role matches", async () => {
    const { guard } = makeGuard(["ORG_OWNER", "ORG_ADMIN"], { role: "ORG_ADMIN" });
    await expect(
      guard.canActivate(makeContext({ id: "u1", role: UserRole.MANAGER }, "org-1")),
    ).resolves.toBe(true);
  });
});
