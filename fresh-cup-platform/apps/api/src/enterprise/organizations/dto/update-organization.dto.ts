import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { Locale } from "@prisma/client";

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: Locale })
  @IsOptional()
  @IsIn(Object.values(Locale))
  defaultLocale?: Locale;

  @ApiPropertyOptional({ example: "ETB" })
  @IsOptional()
  @IsString()
  defaultCurrencyCode?: string;
}
