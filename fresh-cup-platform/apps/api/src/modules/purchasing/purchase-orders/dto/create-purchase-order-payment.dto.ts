import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsPositive, IsString } from "class-validator";

export class CreatePurchaseOrderPaymentDto {
  @ApiProperty({ description: "Payment amount in ETB minor units" })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: "e.g. cash, bank_transfer, mobile_money" })
  @IsString()
  method!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
