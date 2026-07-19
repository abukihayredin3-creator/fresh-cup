import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { FeatureFlagsService } from "./feature-flags.service";

const DEFINITION = { id: "flag-1", key: "enterprise.sso", defaultEnabled: false };

describe("FeatureFlagsService", () => {
  function makeService(overrides: {
    definition?: unknown;
    branchOverride?: unknown;
    orgOverride?: unknown;
  }) {
    const findUniqueOverride = jest.fn().mockImplementation(({ where }) => {
      const branchId = where.organizationId_featureFlagId_branchId.branchId;
      if (branchId === null) return Promise.resolve(overrides.orgOverride ?? null);
      return Promise.resolve(overrides.branchOverride ?? null);
    });
    const prisma = {
      featureFlagDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(overrides.definition ?? null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "flag-1", ...data })),
      },
      featureFlagOverride: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: findUniqueOverride,
        upsert: jest
          .fn()
          .mockImplementation(({ create }) => Promise.resolve({ id: "ov-1", ...create })),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new FeatureFlagsService(prisma), prisma };
  }

  it("resolves to false for an unknown flag key", async () => {
    const { service } = makeService({ definition: null });
    await expect(service.evaluate("org-1", "unknown.flag")).resolves.toBe(false);
  });

  it("falls back to the definition's defaultEnabled with no override", async () => {
    const { service } = makeService({ definition: { ...DEFINITION, defaultEnabled: true } });
    await expect(service.evaluate("org-1", "enterprise.sso")).resolves.toBe(true);
  });

  it("prefers a branch-specific override over the org-wide one", async () => {
    const { service } = makeService({
      definition: DEFINITION,
      branchOverride: { enabled: true, rolloutPercentage: null },
      orgOverride: { enabled: false, rolloutPercentage: null },
    });
    await expect(service.evaluate("org-1", "enterprise.sso", "b1")).resolves.toBe(true);
  });

  it("returns false when the override is explicitly disabled", async () => {
    const { service } = makeService({
      definition: DEFINITION,
      orgOverride: { enabled: false, rolloutPercentage: null },
    });
    await expect(service.evaluate("org-1", "enterprise.sso")).resolves.toBe(false);
  });

  it("is deterministic for the same entity id under a partial rollout", async () => {
    const { service } = makeService({
      definition: DEFINITION,
      orgOverride: { enabled: true, rolloutPercentage: 50 },
    });
    const first = await service.evaluate("org-1", "enterprise.sso");
    const second = await service.evaluate("org-1", "enterprise.sso");
    expect(first).toBe(second);
  });

  it("throws ConflictException when creating a duplicate flag key", async () => {
    const { service } = makeService({ definition: DEFINITION });
    await expect(service.createDefinition({ key: "enterprise.sso", name: "SSO" })).rejects.toThrow(
      ConflictException,
    );
  });

  it("throws NotFoundException when setting an override for an undefined flag", async () => {
    const { service } = makeService({ definition: null });
    await expect(service.setOverride("org-1", "missing.flag", { enabled: true })).rejects.toThrow(
      NotFoundException,
    );
  });
});
