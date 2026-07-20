import { Injectable } from "@nestjs/common";
import type { LocalPaymentMethodConfig } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { SetLocalPaymentMethodDto } from "./dto/set-local-payment-method.dto";

/**
 * A registry over the EXISTING `PaymentMethod` enum and
 * `PaymentProvider` abstraction (Chapa/Cash) — which methods a country
 * offers at checkout, not a new payment-provider implementation. Adding
 * a genuinely new rail (e.g. M-Pesa) still requires a new
 * `PaymentProvider` class this phase does not add.
 */
@Injectable()
export class LocalPaymentMethodService {
  constructor(private readonly prisma: PrismaService) {}

  listForCountry(organizationId: string, countryCode: string): Promise<LocalPaymentMethodConfig[]> {
    return this.prisma.localPaymentMethodConfig.findMany({
      where: { organizationId, countryCode, isEnabled: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  listAll(organizationId: string): Promise<LocalPaymentMethodConfig[]> {
    return this.prisma.localPaymentMethodConfig.findMany({
      where: { organizationId },
      orderBy: [{ countryCode: "asc" }, { sortOrder: "asc" }],
    });
  }

  setConfig(
    organizationId: string,
    dto: SetLocalPaymentMethodDto,
  ): Promise<LocalPaymentMethodConfig> {
    return this.prisma.localPaymentMethodConfig.upsert({
      where: {
        organizationId_countryCode_method: {
          organizationId,
          countryCode: dto.countryCode,
          method: dto.method,
        },
      },
      create: {
        organizationId,
        countryCode: dto.countryCode,
        method: dto.method,
        isEnabled: dto.isEnabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      update: {
        isEnabled: dto.isEnabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
