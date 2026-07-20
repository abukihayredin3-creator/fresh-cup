import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpsertReceiptTemplateDto {
  @ApiProperty({ example: "ET" })
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @ApiPropertyOptional({ example: "Thank you for visiting Fresh Cup!" })
  @IsOptional()
  @IsString()
  legalFooterText?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showTaxBreakdown?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showVatNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional({ default: "YYYY-MM-DD HH:mm" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  dateFormat?: string;
}
