import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { RegionalPricingService } from "./regional-pricing.service";

describe("RegionalPricingService", () => {
  function makeService(
    overrides: {
      region?: unknown;
      menuItem?: unknown;
      override?: unknown;
    } = {},
  ) {
    const prisma = {
      region: { findUnique: jest.fn().mockResolvedValue(overrides.region ?? null) },
      menuItem: { findUnique: jest.fn().mockResolvedValue(overrides.menuItem ?? null) },
      regionalPriceOverride: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(overrides.override ?? null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new RegionalPricingService(prisma), prisma };
  }

  it("throws ForbiddenException when the region belongs to another organization", async () => {
    const { service } = makeService({ region: { id: "region-1", organizationId: "org-2" } });
    await expect(service.list("org-1", "region-1")).rejects.toThrow(ForbiddenException);
  });

  it("throws NotFoundException when setting an override for a menu item outside the org", async () => {
    const { service } = makeService({
      region: { id: "region-1", organizationId: "org-1" },
      menuItem: { id: "item-1", branch: { organizationId: "org-2" } },
    });
    await expect(
      service.setOverride("org-1", "region-1", { menuItemId: "item-1", priceMinor: 5000 }),
    ).rejects.toThrow(NotFoundException);
  });

  it("creates a valid override", async () => {
    const { service } = makeService({
      region: { id: "region-1", organizationId: "org-1" },
      menuItem: { id: "item-1", branch: { organizationId: "org-1" } },
    });
    const result = await service.setOverride("org-1", "region-1", {
      menuItemId: "item-1",
      priceMinor: 5000,
    });
    expect(result).toMatchObject({ regionId: "region-1", menuItemId: "item-1", priceMinor: 5000 });
  });

  it("resolves the override price when one exists for the region", async () => {
    const { service } = makeService({
      menuItem: { id: "item-1", basePrice: 4000 },
      override: { priceMinor: 5000 },
    });
    await expect(service.resolveEffectivePrice("item-1", "region-1")).resolves.toBe(5000);
  });

  it("falls back to the base price when there is no override", async () => {
    const { service } = makeService({
      menuItem: { id: "item-1", basePrice: 4000 },
      override: null,
    });
    await expect(service.resolveEffectivePrice("item-1", "region-1")).resolves.toBe(4000);
  });

  it("falls back to the base price when no region is given", async () => {
    const { service } = makeService({ menuItem: { id: "item-1", basePrice: 4000 } });
    await expect(service.resolveEffectivePrice("item-1", null)).resolves.toBe(4000);
  });

  it("throws NotFoundException for an unknown menu item", async () => {
    const { service } = makeService({ menuItem: null });
    await expect(service.resolveEffectivePrice("missing", null)).rejects.toThrow(NotFoundException);
  });
});
