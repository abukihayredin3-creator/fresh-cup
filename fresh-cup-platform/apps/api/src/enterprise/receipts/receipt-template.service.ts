import { Injectable } from "@nestjs/common";
import type { ReceiptTemplate } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { UpsertReceiptTemplateDto } from "./dto/upsert-receipt-template.dto";

const DEFAULT_TEMPLATE: Pick<
  ReceiptTemplate,
  "legalFooterText" | "showTaxBreakdown" | "showVatNumber" | "vatNumber" | "dateFormat"
> = {
  legalFooterText: null,
  showTaxBreakdown: true,
  showVatNumber: false,
  vatNumber: null,
  dateFormat: "YYYY-MM-DD HH:mm",
};

/**
 * Country-specific receipt formatting — legal footer text, whether to
 * show a tax breakdown line / VAT registration number, and a date
 * format token string. `resolveTemplate()` falls back to a sane
 * built-in default when an organization hasn't configured a country
 * yet, so a receipt can always be rendered.
 */
@Injectable()
export class ReceiptTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string): Promise<ReceiptTemplate[]> {
    return this.prisma.receiptTemplate.findMany({
      where: { organizationId },
      orderBy: { countryCode: "asc" },
    });
  }

  upsert(organizationId: string, dto: UpsertReceiptTemplateDto): Promise<ReceiptTemplate> {
    return this.prisma.receiptTemplate.upsert({
      where: { organizationId_countryCode: { organizationId, countryCode: dto.countryCode } },
      create: {
        organizationId,
        countryCode: dto.countryCode,
        legalFooterText: dto.legalFooterText,
        showTaxBreakdown: dto.showTaxBreakdown ?? DEFAULT_TEMPLATE.showTaxBreakdown,
        showVatNumber: dto.showVatNumber ?? DEFAULT_TEMPLATE.showVatNumber,
        vatNumber: dto.vatNumber,
        dateFormat: dto.dateFormat ?? DEFAULT_TEMPLATE.dateFormat,
      },
      update: {
        legalFooterText: dto.legalFooterText,
        showTaxBreakdown: dto.showTaxBreakdown,
        showVatNumber: dto.showVatNumber,
        vatNumber: dto.vatNumber,
        dateFormat: dto.dateFormat,
      },
    });
  }

  async resolveTemplate(
    organizationId: string,
    countryCode: string,
  ): Promise<Omit<ReceiptTemplate, "id" | "organizationId" | "createdAt" | "updatedAt">> {
    const template = await this.prisma.receiptTemplate.findUnique({
      where: { organizationId_countryCode: { organizationId, countryCode } },
    });
    if (template) {
      return template;
    }
    return { countryCode, ...DEFAULT_TEMPLATE };
  }

  /** Formats a date against a template's token string (YYYY/MM/DD/HH/mm/ss). */
  formatDate(date: Date, dateFormat: string): string {
    const pad = (n: number): string => n.toString().padStart(2, "0");
    return dateFormat
      .replace(/YYYY/g, date.getFullYear().toString())
      .replace(/MM/g, pad(date.getMonth() + 1))
      .replace(/DD/g, pad(date.getDate()))
      .replace(/HH/g, pad(date.getHours()))
      .replace(/mm/g, pad(date.getMinutes()))
      .replace(/ss/g, pad(date.getSeconds()));
  }
}
