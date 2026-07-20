import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class UpsertCurrencyDto {
  @ApiProperty({ example: "ETB", description: "ISO 4217 currency code" })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: "Ethiopian Birr" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: "Br" })
  @IsString()
  @MinLength(1)
  symbol!: string;

  @ApiPropertyOptional({ example: 2, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  decimalDigits?: number;
}
