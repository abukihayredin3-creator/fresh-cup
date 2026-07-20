import { Injectable, NotFoundException } from "@nestjs/common";
import { Locale } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface LocalizationContext {
  locale: Locale;
  timezone: string;
  currencyCode: string;
  countryCode: string | null;
}

/**
 * Resolves the effective locale/timezone/currency for a request. This
 * does not add new translation content — `packages/i18n`'s en/am
 * dictionaries (Phase 4) are the source of translated strings; this
 * service only decides WHICH locale/timezone/currency apply for a given
 * branch, layering three levels that already exist on the schema since
 * Part 1: an org sets defaults (`defaultLocale`/`timezone`/
 * `defaultCurrencyCode`), and a branch's region can override the
 * timezone and implies a country code for tax/receipt lookups.
 */
@Injectable()
export class LocalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForOrganization(organizationId: string): Promise<LocalizationContext> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    return {
      locale: organization.defaultLocale,
      timezone: organization.timezone,
      currencyCode: organization.defaultCurrencyCode,
      countryCode: null,
    };
  }

  async resolveForBranch(organizationId: string, branchId: string): Promise<LocalizationContext> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { organization: true, region: true },
    });
    if (!branch || branch.organizationId !== organizationId) {
      throw new NotFoundException("Branch not found");
    }
    return {
      locale: branch.organization.defaultLocale,
      timezone: branch.region?.timezone ?? branch.organization.timezone,
      currencyCode: branch.organization.defaultCurrencyCode,
      countryCode: branch.region?.countryCode ?? null,
    };
  }

  listSupportedLocales(): Locale[] {
    return Object.values(Locale);
  }
}
