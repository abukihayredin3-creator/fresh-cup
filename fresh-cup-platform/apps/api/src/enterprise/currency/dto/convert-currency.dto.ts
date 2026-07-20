import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsPositive, IsString, MinLength } from "class-validator";

export class ConvertCurrencyDto {
  @ApiProperty({ example: "USD" })
  @IsString()
  @MinLength(3)
  fromCurrencyCode!: string;

  @ApiProperty({ example: "ETB" })
  @IsString()
  @MinLength(3)
  toCurrencyCode!: string;

  @ApiProperty({
    example: 1000,
    description: "Amount in minor units (e.g. cents) of fromCurrencyCode",
  })
  @IsInt()
  @IsPositive()
  amountMinor!: number;
}
