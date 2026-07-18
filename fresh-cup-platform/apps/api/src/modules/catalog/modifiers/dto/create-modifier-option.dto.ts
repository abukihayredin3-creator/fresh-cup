import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateModifierOptionDto {
  @ApiProperty({ example: "Large" })
  @IsString()
  @MinLength(1)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAm?: string;

  @ApiPropertyOptional({
    description: "Added to the item's base price in ETB minor units, e.g. 1000 = +10.00 ETB",
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceDelta?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
