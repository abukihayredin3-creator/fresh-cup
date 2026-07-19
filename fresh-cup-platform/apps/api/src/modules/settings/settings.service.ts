import { Injectable } from "@nestjs/common";
import type { RestaurantSettings } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import type { SettingsResponseDto } from "./dto/settings-response.dto";
import type { UpdateSettingsDto } from "./dto/update-settings.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Singleton row, get-or-create — there's no admin flow to create it explicitly. */
  async getOrCreate(): Promise<RestaurantSettings> {
    const existing = await this.prisma.restaurantSettings.findFirst();
    if (existing) {
      return existing;
    }
    return this.prisma.restaurantSettings.create({ data: {} });
  }

  async update(actor: RequestUser, dto: UpdateSettingsDto): Promise<RestaurantSettings> {
    const current = await this.getOrCreate();
    return this.prisma.restaurantSettings.update({
      where: { id: current.id },
      data: { ...dto, updatedByUserId: actor.id },
    });
  }

  toResponse(settings: RestaurantSettings): SettingsResponseDto {
    return {
      restaurantName: settings.restaurantName,
      defaultLocale: settings.defaultLocale,
      defaultCurrency: settings.defaultCurrency,
      defaultTaxPercent: Number(settings.defaultTaxPercent),
      timezone: settings.timezone,
      logoUrl: settings.logoUrl,
      primaryColorHex: settings.primaryColorHex,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      emailNotifications: settings.emailNotifications,
      smsNotifications: settings.smsNotifications,
      pushNotifications: settings.pushNotifications,
      updatedAt: settings.updatedAt,
    };
  }
}
