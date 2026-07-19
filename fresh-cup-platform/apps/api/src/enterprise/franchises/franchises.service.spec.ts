import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { FranchisesService } from "./franchises.service";

describe("FranchisesService", () => {
  function makeService() {
    const prisma = {
      franchise: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "f1", ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "f1", ...data })),
      },
      branch: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new FranchisesService(prisma), prisma };
  }

  it("throws NotFoundException for a franchise in a different organization", async () => {
    const { service, prisma } = makeService();
    (prisma.franchise.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "f1",
      organizationId: "org-2",
    });
    await expect(service.findByIdOrThrow("org-1", "f1")).rejects.toThrow(NotFoundException);
  });

  it("creates a franchise scoped to the organization", async () => {
    const { service } = makeService();
    const franchise = await service.create("org-1", { name: "Kaldi Group" });
    expect(franchise).toMatchObject({ organizationId: "org-1", name: "Kaldi Group" });
  });

  it("assigns a branch that belongs to the same organization", async () => {
    const { service, prisma } = makeService();
    (prisma.franchise.findUnique as jest.Mock).mockResolvedValue({
      id: "f1",
      organizationId: "org-1",
    });
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-1",
    });
    await service.assignBranch("org-1", "f1", "b1");
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { franchiseId: "f1" },
    });
  });

  it("refuses to assign a branch from a different organization", async () => {
    const { service, prisma } = makeService();
    (prisma.franchise.findUnique as jest.Mock).mockResolvedValue({
      id: "f1",
      organizationId: "org-1",
    });
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-2",
    });
    await expect(service.assignBranch("org-1", "f1", "b1")).rejects.toThrow(ForbiddenException);
  });
});
