import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { EnterpriseAuditService } from "../audit/enterprise-audit.service";
import { ScimService } from "./scim.service";

const USER = {
  id: "user-1",
  email: "user@example.com",
  fullName: "Test User",
  isActive: true,
  branchId: "b1",
};

describe("ScimService", () => {
  function makeService(overrides: {
    user?: unknown;
    branch?: unknown;
    existingUser?: unknown;
    defaultBranch?: unknown;
  }) {
    const prisma = {
      scimToken: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "tok-1", ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([USER]),
        findUnique: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(overrides.user !== undefined ? overrides.user : USER),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "user-new", ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...USER, ...data })),
      },
      branch: {
        findUnique: jest
          .fn()
          .mockResolvedValue(overrides.branch ?? { id: "b1", organizationId: "org-1" }),
        findFirst: jest.fn().mockResolvedValue(overrides.defaultBranch ?? { id: "b1" }),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EnterpriseAuditService>;

    return { service: new ScimService(prisma, auditService), prisma, auditService };
  }

  it("creates a token and returns the raw value once", async () => {
    const { service } = makeService({});
    const result = await service.createToken("org-1", { name: "Okta" });
    expect(result.token).toHaveLength(64);
    expect(result.name).toBe("Okta");
  });

  it("throws NotFoundException revoking a token from a different organization", async () => {
    const { service, prisma } = makeService({});
    (prisma.scimToken.findUnique as jest.Mock).mockResolvedValue({
      id: "tok-1",
      organizationId: "org-2",
    });
    await expect(service.revokeToken("org-1", "tok-1")).rejects.toThrow(NotFoundException);
  });

  it("lists users scoped to the organization as SCIM resources", async () => {
    const { service } = makeService({});
    const result = await service.listUsers("org-1");
    expect(result.totalResults).toBe(1);
    expect(result.Resources[0]).toMatchObject({
      userName: "user@example.com",
      active: true,
    });
  });

  it("filters users by userName eq", async () => {
    const { service, prisma } = makeService({});
    await service.listUsers("org-1", 'userName eq "user@example.com"');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: "user@example.com" }),
      }),
    );
  });

  it("throws ConflictException creating a user that already exists", async () => {
    const { service } = makeService({});
    await expect(service.createUser("org-1", { userName: "user@example.com" })).rejects.toThrow(
      ConflictException,
    );
  });

  it("provisions a new user into the organization's oldest branch", async () => {
    const { service, prisma } = makeService({ user: null, defaultBranch: { id: "b-oldest" } });
    const resource = await service.createUser("org-1", { userName: "new@example.com" });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: "b-oldest" }) }),
    );
    expect(resource.userName).toBe("new@example.com");
  });

  it("patches active=false via a replace operation", async () => {
    const { service, prisma } = makeService({});
    const resource = await service.patchUser("org-1", "user-1", [
      { op: "replace", path: "active", value: false },
    ]);
    expect(resource.active).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: false },
    });
  });

  it("rejects an unsupported PatchOp", async () => {
    const { service } = makeService({});
    await expect(
      service.patchUser("org-1", "user-1", [{ op: "add", path: "emails", value: [] }]),
    ).rejects.toThrow(ForbiddenException);
  });

  it("deactivates rather than hard-deletes on DELETE", async () => {
    const { service, prisma } = makeService({});
    await service.deleteUser("org-1", "user-1");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: false },
    });
  });

  it("throws NotFoundException for a user whose branch belongs to another organization", async () => {
    const { service, prisma } = makeService({});
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-9",
    });
    await expect(service.getUser("org-1", "user-1")).rejects.toThrow(NotFoundException);
  });
});
