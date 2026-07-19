import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class OnboardTenantDto {
  @ApiProperty({ example: "Kaldi Coffee Group" })
  @IsString()
  @MinLength(1)
  organizationName!: string;

  @ApiProperty({ example: "kaldi-coffee", description: "URL-safe, unique across the platform" })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: "organizationSlug must be lowercase, hyphen-separated",
  })
  organizationSlug!: string;

  @ApiPropertyOptional({ example: "Africa/Addis_Ababa" })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: "ETB" })
  @IsOptional()
  @IsString()
  defaultCurrencyCode?: string;

  @ApiProperty({ example: "Kaldi — Bole" })
  @IsString()
  @MinLength(1)
  branchName!: string;

  @ApiProperty({ example: "Bole, Addis Ababa" })
  @IsString()
  @MinLength(1)
  branchAddressText!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  adminFullName!: string;

  @ApiProperty()
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
