import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, MinLength } from "class-validator";

export class CalculateTaxDto {
  @ApiProperty({ example: "ET" })
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  menuCategoryId?: string;

  @ApiProperty({ example: 10000, description: "Amount in minor units" })
  @IsInt()
  @IsPositive()
  amountMinor!: number;
}
