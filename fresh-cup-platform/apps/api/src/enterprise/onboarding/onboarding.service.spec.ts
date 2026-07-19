import { ConflictException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { OnboardingService } from "./onboarding.service";

const DTO = {
  organizationName: "Kaldi Coffee Group",
  organizationSlug: "kaldi-coffee",
  branchName: "Kaldi — Bole",
  branchAddressText: "Bole, Addis Ababa",
  adminFullName: "Kaldi Admin",
  adminEmail: "admin@kaldi.example",
  adminPassword: "SuperSecret123!",
};

describe("OnboardingService", () => {
  function makeService(overrides: { existingSlug?: unknown; existingEmail?: unknown }) {
    const tx = {
      organization: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "org-1", ...data })),
        update: jest.fn().mockResolvedValue(undefined),
      },
      branch: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "branch-1", ...data })),
      },
      user: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "user-1", ...data })),
      },
      organizationMembership: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(overrides.existingSlug ?? null),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(overrides.existingEmail ?? null),
      },
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(tx)),
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new OnboardingService(prisma), prisma, tx };
  }

  it("throws ConflictException when the organization slug is taken", async () => {
    const { service } = makeService({ existingSlug: { id: "org-existing" } });
    await expect(service.onboard(DTO)).rejects.toThrow(ConflictException);
  });

  it("throws ConflictException when the admin email is already registered", async () => {
    const { service } = makeService({ existingEmail: { id: "user-existing" } });
    await expect(service.onboard(DTO)).rejects.toThrow(ConflictException);
  });

  it("creates the organization, branch, admin user, and membership atomically", async () => {
    const { service, tx } = makeService({});
    const result = await service.onboard(DTO);

    expect(tx.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: DTO.organizationName, slug: DTO.organizationSlug }),
      }),
    );
    expect(tx.branch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "org-1" }),
      }),
    );
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: DTO.adminEmail, branchId: "branch-1" }),
      }),
    );
    expect(tx.organizationMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          userId: "user-1",
          role: "ORG_OWNER",
        }),
      }),
    );
    expect(tx.organization.update).toHaveBeenCalled();
    expect(result).toEqual({
      organizationId: "org-1",
      organizationSlug: DTO.organizationSlug,
      branchId: "branch-1",
      adminUserId: "user-1",
    });
  });
});
