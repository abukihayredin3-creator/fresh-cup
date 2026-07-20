import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { CurrencyService } from "./currency.service";

function decimal(n: number) {
  return { toNumber: () => n };
}

describe("CurrencyService", () => {
  function makeService(overrides: { direct?: unknown; inverse?: unknown } = {}) {
    const prisma = {
      currency: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
      exchangeRate: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const key = where.organizationId_baseCurrencyCode_quoteCurrencyCode;
          if (
            overrides.direct &&
            key.baseCurrencyCode === "USD" &&
            key.quoteCurrencyCode === "ETB"
          ) {
            return Promise.resolve(overrides.direct);
          }
          if (
            overrides.inverse &&
            key.baseCurrencyCode === "ETB" &&
            key.quoteCurrencyCode === "USD"
          ) {
            return Promise.resolve(overrides.inverse);
          }
          return Promise.resolve(null);
        }),
      },
    } as unknown as jest.Mocked<PrismaService>;
    return { service: new CurrencyService(prisma), prisma };
  }

  it("converts using a direct exchange rate", async () => {
    const { service } = makeService({
      direct: { rate: decimal(120), asOf: new Date("2026-01-01") },
    });
    const result = await service.convert("org-1", {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      amountMinor: 1000,
    });
    expect(result.convertedAmountMinor).toBe(120000);
    expect(result.rate).toBe(120);
  });

  it("converts using an inverted exchange rate when no direct rate is on file", async () => {
    const { service } = makeService({
      inverse: { rate: decimal(0.01), asOf: new Date("2026-01-01") },
    });
    const result = await service.convert("org-1", {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      amountMinor: 1000,
    });
    expect(result.convertedAmountMinor).toBe(100000);
  });

  it("passes an amount through unchanged for a same-currency conversion", async () => {
    const { service } = makeService();
    const result = await service.convert("org-1", {
      fromCurrencyCode: "ETB",
      toCurrencyCode: "ETB",
      amountMinor: 500,
    });
    expect(result).toMatchObject({ convertedAmountMinor: 500, rate: 1 });
  });

  it("throws NotFoundException when no rate exists in either direction", async () => {
    const { service } = makeService();
    await expect(
      service.convert("org-1", {
        fromCurrencyCode: "USD",
        toCurrencyCode: "ETB",
        amountMinor: 500,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
