import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { EnterpriseSessionsService } from "./enterprise-sessions.service";

describe("EnterpriseSessionsService", () => {
  function makeService(overrides: { token?: unknown; user?: unknown; branch?: unknown }) {
    const prisma = {
      refreshToken: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "tok-1",
            userId: "user-1",
            createdAt: new Date(),
            expiresAt: new Date(),
            user: { email: "u@example.com", fullName: "Test User" },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue(
          overrides.token !== undefined
            ? overrides.token
            : {
                id: "tok-1",
                user: { branch: { organizationId: "org-1" } },
              },
        ),
        update: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            overrides.user !== undefined ? overrides.user : { id: "user-1", branchId: "b1" },
          ),
      },
      branch: {
        findUnique: jest
          .fn()
          .mockResolvedValue(overrides.branch ?? { id: "b1", organizationId: "org-1" }),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new EnterpriseSessionsService(prisma), prisma };
  }

  it("lists active sessions across the organization", async () => {
    const { service } = makeService({});
    const sessions = await service.listOrgSessions("org-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ userId: "user-1", userEmail: "u@example.com" });
  });

  it("revokes a session belonging to the organization", async () => {
    const { service, prisma } = makeService({});
    await service.revokeSession("org-1", "tok-1");
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "tok-1" },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("refuses to revoke a session from a different organization", async () => {
    const { service } = makeService({
      token: { id: "tok-1", user: { branch: { organizationId: "org-2" } } },
    });
    await expect(service.revokeSession("org-1", "tok-1")).rejects.toThrow(ForbiddenException);
  });

  it("revokes all sessions for a user in the same organization", async () => {
    const { service, prisma } = makeService({});
    await service.revokeAllForUser("org-1", "user-1");
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("refuses to revoke sessions for a user outside the organization", async () => {
    const { service } = makeService({ branch: { id: "b1", organizationId: "org-9" } });
    await expect(service.revokeAllForUser("org-1", "user-1")).rejects.toThrow(ForbiddenException);
  });

  it("refuses to revoke sessions for a branch-less user", async () => {
    const { service } = makeService({ user: { id: "user-1", branchId: null } });
    await expect(service.revokeAllForUser("org-1", "user-1")).rejects.toThrow(ForbiddenException);
  });
});
