import { NotFoundException } from "@nestjs/common";
import { Locale } from "@prisma/client";
import type { PrismaService } from "../../database/prisma.service";
import { LocalizationService } from "./localization.service";

describe("LocalizationService", () => {
  function makeService(overrides: { organization?: unknown; branch?: unknown } = {}) {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(overrides.organization ?? null),
      },
      branch: {
        findUnique: jest.fn().mockResolvedValue(overrides.branch ?? null),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new LocalizationService(prisma) };
  }

  it("resolves org-level defaults when no branch override exists", async () => {
    const { service } = makeService({
      organization: {
        id: "org-1",
        defaultLocale: Locale.AM,
        timezone: "Africa/Addis_Ababa",
        defaultCurrencyCode: "ETB",
      },
    });
    await expect(service.resolveForOrganization("org-1")).resolves.toEqual({
      locale: Locale.AM,
      timezone: "Africa/Addis_Ababa",
      currencyCode: "ETB",
      countryCode: null,
    });
  });

  it("throws NotFoundException for an unknown organization", async () => {
    const { service } = makeService({ organization: null });
    await expect(service.resolveForOrganization("missing")).rejects.toThrow(NotFoundException);
  });

  it("resolves a branch's region timezone/countryCode over the org default", async () => {
    const { service } = makeService({
      branch: {
        id: "branch-1",
        organizationId: "org-1",
        organization: {
          defaultLocale: Locale.EN,
          timezone: "Africa/Addis_Ababa",
          defaultCurrencyCode: "ETB",
        },
        region: { timezone: "America/New_York", countryCode: "US" },
      },
    });
    await expect(service.resolveForBranch("org-1", "branch-1")).resolves.toEqual({
      locale: Locale.EN,
      timezone: "America/New_York",
      currencyCode: "ETB",
      countryCode: "US",
    });
  });

  it("falls back to the org timezone when a branch has no region", async () => {
    const { service } = makeService({
      branch: {
        id: "branch-1",
        organizationId: "org-1",
        organization: {
          defaultLocale: Locale.EN,
          timezone: "Africa/Addis_Ababa",
          defaultCurrencyCode: "ETB",
        },
        region: null,
      },
    });
    await expect(service.resolveForBranch("org-1", "branch-1")).resolves.toMatchObject({
      timezone: "Africa/Addis_Ababa",
      countryCode: null,
    });
  });

  it("throws NotFoundException for a branch in a different organization", async () => {
    const { service } = makeService({
      branch: { id: "branch-1", organizationId: "org-2" },
    });
    await expect(service.resolveForBranch("org-1", "branch-1")).rejects.toThrow(NotFoundException);
  });
});
