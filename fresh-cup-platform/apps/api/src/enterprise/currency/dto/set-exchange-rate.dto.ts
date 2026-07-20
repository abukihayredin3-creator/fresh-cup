import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsPositive, IsString, MinLength } from "class-validator";

export class SetExchangeRateDto {
  @ApiProperty({ example: "USD" })
  @IsString()
  @MinLength(3)
  baseCurrencyCode!: string;

  @ApiProperty({ example: "ETB" })
  @IsString()
  @MinLength(3)
  quoteCurrencyCode!: string;

  @ApiProperty({ example: 123.45, description: "1 base currency = `rate` quote currency" })
  @IsNumber()
  @IsPositive()
  rate!: number;
}
