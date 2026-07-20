import { Injectable, NotFoundException } from "@nestjs/common";
import type { TaxRule } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { CalculateTaxDto } from "./dto/calculate-tax.dto";
import type { CreateTaxRuleDto } from "./dto/create-tax-rule.dto";

export interface TaxCalculationResult {
  ruleId: string;
  ruleName: string;
  ratePercent: number;
  isInclusive: boolean;
  amountMinor: number;
  taxAmountMinor: number;
  totalAmountMinor: number;
}

/**
 * A rule-based tax lookup — NOT a live tax-jurisdiction API integration
 * (see TaxRule's schema docblock). `calculateTax()` picks the most
 * specific matching rule: an exact menu-category match beats an
 * exact-region match beats a country-wide default.
 */
@Injectable()
export class TaxEngineService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<TaxRule[]> {
    return this.prisma.taxRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  create(organizationId: string, dto: CreateTaxRuleDto): Promise<TaxRule> {
    return this.prisma.taxRule.create({
      data: {
        organizationId,
        countryCode: dto.countryCode,
        regionId: dto.regionId,
        menuCategoryId: dto.menuCategoryId,
        name: dto.name,
        ratePercent: dto.ratePercent,
        isInclusive: dto.isInclusive ?? true,
      },
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const rule = await this.prisma.taxRule.findUnique({ where: { id } });
    if (!rule || rule.organizationId !== organizationId) {
      throw new NotFoundException("Tax rule not found");
    }
    await this.prisma.taxRule.delete({ where: { id } });
  }

  async calculateTax(organizationId: string, dto: CalculateTaxDto): Promise<TaxCalculationResult> {
    const candidates = await this.prisma.taxRule.findMany({
      where: {
        organizationId,
        countryCode: dto.countryCode,
        OR: [{ regionId: null }, { regionId: dto.regionId ?? "__none__" }],
      },
    });

    const matching = candidates.filter(
      (rule) => rule.menuCategoryId === null || rule.menuCategoryId === dto.menuCategoryId,
    );
    if (matching.length === 0) {
      throw new NotFoundException(`No tax rule on file for country '${dto.countryCode}'`);
    }

    const best = matching.reduce((mostSpecific, rule) => {
      return this.specificity(rule) > this.specificity(mostSpecific) ? rule : mostSpecific;
    }, matching[0]!);

    const ratePercent = best.ratePercent.toNumber();
    const taxAmountMinor = best.isInclusive
      ? Math.round((dto.amountMinor * ratePercent) / (100 + ratePercent))
      : Math.round((dto.amountMinor * ratePercent) / 100);
    const totalAmountMinor = best.isInclusive ? dto.amountMinor : dto.amountMinor + taxAmountMinor;

    return {
      ruleId: best.id,
      ruleName: best.name,
      ratePercent,
      isInclusive: best.isInclusive,
      amountMinor: dto.amountMinor,
      taxAmountMinor,
      totalAmountMinor,
    };
  }

  private specificity(rule: TaxRule): number {
    return (rule.menuCategoryId ? 2 : 0) + (rule.regionId ? 1 : 0);
  }
}
