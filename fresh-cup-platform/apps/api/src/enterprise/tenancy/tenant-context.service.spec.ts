import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../../common/types/request-user.interface";
import { TenantContextService } from "./tenant-context.service";

describe("TenantContextService", () => {
  function makeService(overrides: {
    branch?: { organizationId: string } | null;
    memberships?: { organizationId: string }[];
  }) {
    const prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue(overrides.branch ?? null),
      },
      organizationMembership: {
        findMany: jest.fn().mockResolvedValue(overrides.memberships ?? []),
      },
    } as unknown as jest.Mocked<PrismaService>;
    const service = new TenantContextService(prisma);
    return { service, prisma };
  }

  it("resolves via the actor's branch when branchId is set", async () => {
    const { service } = makeService({ branch: { organizationId: "org-1" } });
    const actor: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: "b1" };
    await expect(service.resolveOrganizationId(actor)).resolves.toBe("org-1");
  });

  it("throws if the requested org header disagrees with the branch's organization", async () => {
    const { service } = makeService({ branch: { organizationId: "org-1" } });
    const actor: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: "b1" };
    await expect(service.resolveOrganizationId(actor, "org-2")).rejects.toThrow(ForbiddenException);
  });

  it("throws when the actor's branch cannot be resolved", async () => {
    const { service } = makeService({ branch: null });
    const actor: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: "b1" };
    await expect(service.resolveOrganizationId(actor)).rejects.toThrow(ForbiddenException);
  });

  it("resolves via a single OrganizationMembership when the actor has no branch", async () => {
    const { service } = makeService({ memberships: [{ organizationId: "org-1" }] });
    const actor: RequestUser = { id: "u1", role: "ADMIN" as never, branchId: null };
    await expect(service.resolveOrganizationId(actor)).resolves.toBe("org-1");
  });

  it("throws when a branch-less actor has no memberships", async () => {
    const { service } = makeService({ memberships: [] });
    const actor: RequestUser = { id: "u1", role: "ADMIN" as never, branchId: null };
    await expect(service.resolveOrganizationId(actor)).rejects.toThrow(ForbiddenException);
  });

  it("throws when a branch-less actor has multiple memberships and no header", async () => {
    const { service } = makeService({
      memberships: [{ organizationId: "org-1" }, { organizationId: "org-2" }],
    });
    const actor: RequestUser = { id: "u1", role: "ADMIN" as never, branchId: null };
    await expect(service.resolveOrganizationId(actor)).rejects.toThrow(ForbiddenException);
  });

  it("resolves the requested org when it matches one of the actor's memberships", async () => {
    const { service } = makeService({
      memberships: [{ organizationId: "org-1" }, { organizationId: "org-2" }],
    });
    const actor: RequestUser = { id: "u1", role: "ADMIN" as never, branchId: null };
    await expect(service.resolveOrganizationId(actor, "org-2")).resolves.toBe("org-2");
  });

  it("throws when the requested org isn't one of the actor's memberships", async () => {
    const { service } = makeService({ memberships: [{ organizationId: "org-1" }] });
    const actor: RequestUser = { id: "u1", role: "ADMIN" as never, branchId: null };
    await expect(service.resolveOrganizationId(actor, "org-9")).rejects.toThrow(ForbiddenException);
  });
});
