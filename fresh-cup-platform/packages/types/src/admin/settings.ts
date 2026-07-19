import type { Locale } from "../common";

export interface RestaurantSettings {
  restaurantName: string;
  defaultLocale: Locale;
  defaultCurrency: string;
  defaultTaxPercent: number;
  timezone: string;
  logoUrl: string | null;
  primaryColorHex: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  updatedAt: string;
}

export type UpdateSettingsInput = Partial<Omit<RestaurantSettings, "updatedAt">>;
