import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateTaxRuleDto {
  @ApiProperty({ example: "ET" })
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @ApiPropertyOptional({ description: "Narrow this rule to one region; omit for country-wide" })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ description: "Narrow this rule to one menu category" })
  @IsOptional()
  @IsUUID()
  menuCategoryId?: string;

  @ApiProperty({ example: "VAT" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 15, description: "Tax rate as a percentage, e.g. 15 for 15%" })
  @IsNumber()
  @IsPositive()
  ratePercent!: number;

  @ApiPropertyOptional({
    default: true,
    description:
      "True: price already includes tax (VAT-style). False: tax added at checkout (sales-tax-style).",
  })
  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;
}
