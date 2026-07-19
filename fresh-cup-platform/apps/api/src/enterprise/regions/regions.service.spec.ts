import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { RegionsService } from "./regions.service";

describe("RegionsService", () => {
  function makeService() {
    const prisma = {
      region: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "r1", ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "r1", ...data })),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      branch: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new RegionsService(prisma), prisma };
  }

  it("throws NotFoundException for a region in a different organization", async () => {
    const { service, prisma } = makeService();
    (prisma.region.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "r1",
      organizationId: "org-2",
    });
    await expect(service.findByIdOrThrow("org-1", "r1")).rejects.toThrow(NotFoundException);
  });

  it("creates a region scoped to the organization", async () => {
    const { service } = makeService();
    const region = await service.create("org-1", {
      name: "Addis Ababa",
      code: "AA",
      countryCode: "ET",
      timezone: "Africa/Addis_Ababa",
    });
    expect(region).toMatchObject({ organizationId: "org-1", name: "Addis Ababa" });
  });

  it("assigns a branch that belongs to the same organization", async () => {
    const { service, prisma } = makeService();
    (prisma.region.findUnique as jest.Mock).mockResolvedValue({
      id: "r1",
      organizationId: "org-1",
    });
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-1",
    });
    await service.assignBranch("org-1", "r1", "b1");
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { regionId: "r1" },
    });
  });

  it("refuses to assign a branch from a different organization", async () => {
    const { service, prisma } = makeService();
    (prisma.region.findUnique as jest.Mock).mockResolvedValue({
      id: "r1",
      organizationId: "org-1",
    });
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: "b1",
      organizationId: "org-2",
    });
    await expect(service.assignBranch("org-1", "r1", "b1")).rejects.toThrow(ForbiddenException);
  });
});
