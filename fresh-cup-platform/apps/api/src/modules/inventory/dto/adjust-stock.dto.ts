import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InventoryTransactionReason } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString, NotEquals } from "class-validator";

export class AdjustStockDto {
  @ApiProperty({
    description: "Signed change in stock (negative to remove, positive to add)",
    example: -2.5,
  })
  @IsNumber()
  @NotEquals(0)
  delta!: number;

  @ApiProperty({ enum: InventoryTransactionReason })
  @IsEnum(InventoryTransactionReason)
  reason!: InventoryTransactionReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
