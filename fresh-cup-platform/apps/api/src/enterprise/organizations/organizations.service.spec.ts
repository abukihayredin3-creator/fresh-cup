import { NotFoundException } from "@nestjs/common";
import { OrganizationStatus, Locale } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { OrganizationsService } from "./organizations.service";

const ORG = {
  id: "org-1",
  name: "Fresh Cup",
  slug: "fresh-cup",
  domain: null,
  status: OrganizationStatus.ACTIVE,
  timezone: "Africa/Addis_Ababa",
  defaultLocale: Locale.EN,
  defaultCurrencyCode: "ETB",
  onboardingCompletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("OrganizationsService", () => {
  function makeService() {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(ORG),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...ORG, ...data })),
      },
      branch: { count: jest.fn().mockResolvedValue(3) },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new OrganizationsService(prisma), prisma };
  }

  it("throws NotFoundException when the organization does not exist", async () => {
    const { service, prisma } = makeService();
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.findByIdOrThrow("missing")).rejects.toThrow(NotFoundException);
  });

  it("updates an organization's fields", async () => {
    const { service } = makeService();
    const updated = await service.update("org-1", { name: "New Name" });
    expect(updated.name).toBe("New Name");
  });

  it("includes the branch count in the response DTO", async () => {
    const { service } = makeService();
    const dto = await service.toResponse(ORG);
    expect(dto.branchCount).toBe(3);
    expect(dto.slug).toBe("fresh-cup");
  });
});
