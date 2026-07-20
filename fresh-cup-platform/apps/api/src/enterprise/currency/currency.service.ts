import { Injectable, NotFoundException } from "@nestjs/common";
import type { Currency, ExchangeRate } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { ConvertCurrencyDto } from "./dto/convert-currency.dto";
import type { SetExchangeRateDto } from "./dto/set-exchange-rate.dto";
import type { UpsertCurrencyDto } from "./dto/upsert-currency.dto";

export interface ConversionResult {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  amountMinor: number;
  convertedAmountMinor: number;
  rate: number;
  asOf: Date | null;
}

/**
 * `Currency` is a global (not org-scoped) registry of ISO 4217 codes.
 * `ExchangeRate` is org-scoped and admin-maintained — deliberately NOT a
 * live FX-feed integration (consistent with this platform's default of
 * not reaching for a new external service). An org admin records the
 * rate they want used (e.g. from their bank's daily posted rate) and
 * `convert()` looks it up, direct or inverted, as of the most recent
 * entry.
 */
@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  listCurrencies(): Promise<Currency[]> {
    return this.prisma.currency.findMany({ orderBy: { code: "asc" } });
  }

  upsertCurrency(dto: UpsertCurrencyDto): Promise<Currency> {
    return this.prisma.currency.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        name: dto.name,
        symbol: dto.symbol,
        decimalDigits: dto.decimalDigits,
      },
      update: { name: dto.name, symbol: dto.symbol, decimalDigits: dto.decimalDigits },
    });
  }

  listExchangeRates(organizationId: string): Promise<ExchangeRate[]> {
    return this.prisma.exchangeRate.findMany({
      where: { organizationId },
      orderBy: { asOf: "desc" },
    });
  }

  setExchangeRate(organizationId: string, dto: SetExchangeRateDto): Promise<ExchangeRate> {
    return this.prisma.exchangeRate.upsert({
      where: {
        organizationId_baseCurrencyCode_quoteCurrencyCode: {
          organizationId,
          baseCurrencyCode: dto.baseCurrencyCode,
          quoteCurrencyCode: dto.quoteCurrencyCode,
        },
      },
      create: {
        organizationId,
        baseCurrencyCode: dto.baseCurrencyCode,
        quoteCurrencyCode: dto.quoteCurrencyCode,
        rate: dto.rate,
        asOf: new Date(),
      },
      update: { rate: dto.rate, asOf: new Date() },
    });
  }

  async convert(organizationId: string, dto: ConvertCurrencyDto): Promise<ConversionResult> {
    if (dto.fromCurrencyCode === dto.toCurrencyCode) {
      return {
        fromCurrencyCode: dto.fromCurrencyCode,
        toCurrencyCode: dto.toCurrencyCode,
        amountMinor: dto.amountMinor,
        convertedAmountMinor: dto.amountMinor,
        rate: 1,
        asOf: null,
      };
    }

    const direct = await this.prisma.exchangeRate.findUnique({
      where: {
        organizationId_baseCurrencyCode_quoteCurrencyCode: {
          organizationId,
          baseCurrencyCode: dto.fromCurrencyCode,
          quoteCurrencyCode: dto.toCurrencyCode,
        },
      },
    });
    if (direct) {
      const rate = direct.rate.toNumber();
      return this.buildResult(dto, rate, direct.asOf);
    }

    const inverse = await this.prisma.exchangeRate.findUnique({
      where: {
        organizationId_baseCurrencyCode_quoteCurrencyCode: {
          organizationId,
          baseCurrencyCode: dto.toCurrencyCode,
          quoteCurrencyCode: dto.fromCurrencyCode,
        },
      },
    });
    if (inverse) {
      const rate = 1 / inverse.rate.toNumber();
      return this.buildResult(dto, rate, inverse.asOf);
    }

    throw new NotFoundException(
      `No exchange rate on file between ${dto.fromCurrencyCode} and ${dto.toCurrencyCode}`,
    );
  }

  private buildResult(dto: ConvertCurrencyDto, rate: number, asOf: Date): ConversionResult {
    return {
      fromCurrencyCode: dto.fromCurrencyCode,
      toCurrencyCode: dto.toCurrencyCode,
      amountMinor: dto.amountMinor,
      convertedAmountMinor: Math.round(dto.amountMinor * rate),
      rate,
      asOf,
    };
  }
}
