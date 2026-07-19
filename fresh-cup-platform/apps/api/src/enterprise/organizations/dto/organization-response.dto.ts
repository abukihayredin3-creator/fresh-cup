import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { Locale, OrganizationStatus } from "@prisma/client";

export class OrganizationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  domain?: string | null;

  @ApiProperty()
  status!: OrganizationStatus;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  defaultLocale!: Locale;

  @ApiProperty()
  defaultCurrencyCode!: string;

  @ApiPropertyOptional()
  onboardingCompletedAt?: Date | null;

  @ApiProperty()
  branchCount!: number;
}
