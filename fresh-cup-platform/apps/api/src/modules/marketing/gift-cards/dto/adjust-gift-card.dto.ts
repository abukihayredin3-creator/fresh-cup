import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, NotEquals } from "class-validator";

export class AdjustGiftCardDto {
  @ApiProperty({
    description: "Signed change in balance, ETB minor units (negative to redeem/debit)",
  })
  @IsInt()
  @NotEquals(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
