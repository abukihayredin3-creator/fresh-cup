import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { TaxEngineService } from "./tax-engine.service";

function decimal(n: number) {
  return { toNumber: () => n };
}

describe("TaxEngineService", () => {
  function makeService(rules: unknown[]) {
    const prisma = {
      taxRule: {
        findMany: jest.fn().mockResolvedValue(rules),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "rule-1", ...data })),
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new TaxEngineService(prisma), prisma };
  }

  it("throws NotFoundException when no rule matches the country", async () => {
    const { service } = makeService([]);
    await expect(
      service.calculateTax("org-1", { countryCode: "US", amountMinor: 1000 }),
    ).rejects.toThrow(NotFoundException);
  });

  it("computes inclusive VAT-style tax (already in the price)", async () => {
    const { service } = makeService([
      {
        id: "rule-1",
        name: "VAT",
        countryCode: "ET",
        regionId: null,
        menuCategoryId: null,
        ratePercent: decimal(15),
        isInclusive: true,
      },
    ]);
    const result = await service.calculateTax("org-1", { countryCode: "ET", amountMinor: 11500 });
    expect(result.taxAmountMinor).toBe(1500);
    expect(result.totalAmountMinor).toBe(11500);
  });

  it("computes exclusive sales-tax-style tax (added at checkout)", async () => {
    const { service } = makeService([
      {
        id: "rule-1",
        name: "Sales Tax",
        countryCode: "US",
        regionId: null,
        menuCategoryId: null,
        ratePercent: decimal(8),
        isInclusive: false,
      },
    ]);
    const result = await service.calculateTax("org-1", { countryCode: "US", amountMinor: 10000 });
    expect(result.taxAmountMinor).toBe(800);
    expect(result.totalAmountMinor).toBe(10800);
  });

  it("prefers a menu-category-specific rule over a country-wide default", async () => {
    const { service } = makeService([
      {
        id: "default-rule",
        name: "Default VAT",
        countryCode: "ET",
        regionId: null,
        menuCategoryId: null,
        ratePercent: decimal(15),
        isInclusive: true,
      },
      {
        id: "category-rule",
        name: "Alcohol Excise",
        countryCode: "ET",
        regionId: null,
        menuCategoryId: "cat-alcohol",
        ratePercent: decimal(30),
        isInclusive: true,
      },
    ]);
    const result = await service.calculateTax("org-1", {
      countryCode: "ET",
      menuCategoryId: "cat-alcohol",
      amountMinor: 10000,
    });
    expect(result.ruleId).toBe("category-rule");
  });
});
