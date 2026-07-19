import { ApiProperty } from "@nestjs/swagger";
import { Locale } from "@prisma/client";

export class SettingsResponseDto {
  @ApiProperty()
  restaurantName!: string;

  @ApiProperty({ enum: Locale })
  defaultLocale!: Locale;

  @ApiProperty()
  defaultCurrency!: string;

  @ApiProperty()
  defaultTaxPercent!: number;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true })
  primaryColorHex!: string | null;

  @ApiProperty({ nullable: true })
  supportEmail!: string | null;

  @ApiProperty({ nullable: true })
  supportPhone!: string | null;

  @ApiProperty()
  emailNotifications!: boolean;

  @ApiProperty()
  smsNotifications!: boolean;

  @ApiProperty()
  pushNotifications!: boolean;

  @ApiProperty()
  updatedAt!: Date;
}
