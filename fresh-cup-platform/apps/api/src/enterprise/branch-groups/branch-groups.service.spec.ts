import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { BranchGroupsService } from "./branch-groups.service";

describe("BranchGroupsService", () => {
  function makeService() {
    const prisma = {
      branchGroup: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "g1", ...data })),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      branch: { findUnique: jest.fn() },
      branchGroupMembership: {
        upsert: jest.fn().mockResolvedValue(undefined),
        deleteMany: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([{ branchId: "b1" }, { branchId: "b2" }]),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new BranchGroupsService(prisma), prisma };
  }

  it("throws NotFoundException for a group in a different organization", async () => {
    const { service, prisma } = makeService();
    (prisma.branchGroup.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "g1",
      organizationId: "org-2",
    });
    await expect(service.findByIdOrThrow("org-1", "g1")).rejects.toThrow(NotFoundException);
  });

  it("adds a branch from the same organization via upsert", async () => {
    const { service, prisma } = makeService();
    (prisma.branchGroup.findUnique as jest.Mock).mockResolvedValue({
      id: "g1",
      organizationId: "org-1",
    });
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-1",
    });
    await service.addBranch("org-1", "g1", "b1");
    expect(prisma.branchGroupMembership.upsert).toHaveBeenCalled();
  });

  it("refuses to add a branch from a different organization", async () => {
    const { service, prisma } = makeService();
    (prisma.branchGroup.findUnique as jest.Mock).mockResolvedValue({
      id: "g1",
      organizationId: "org-1",
    });
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-2",
    });
    await expect(service.addBranch("org-1", "g1", "b1")).rejects.toThrow(ForbiddenException);
  });

  it("lists branch ids in the group", async () => {
    const { service, prisma } = makeService();
    (prisma.branchGroup.findUnique as jest.Mock).mockResolvedValue({
      id: "g1",
      organizationId: "org-1",
    });
    const ids = await service.listBranches("org-1", "g1");
    expect(ids).toEqual(["b1", "b2"]);
  });
});
