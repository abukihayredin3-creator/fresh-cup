import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InventoryUnit } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty({ example: "Mango (kg)" })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: InventoryUnit })
  @IsEnum(InventoryUnit)
  unit!: InventoryUnit;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderThreshold?: number;

  @ApiProperty({ description: "Cost per unit in ETB minor units", example: 8000 })
  @IsInt()
  @Min(0)
  unitCost!: number;
}
