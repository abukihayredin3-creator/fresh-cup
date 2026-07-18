import { ApiProperty } from "@nestjs/swagger";
import { InventoryUnit } from "@prisma/client";

export class InventoryItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: InventoryUnit })
  unit!: InventoryUnit;

  @ApiProperty()
  currentStock!: number;

  @ApiProperty()
  reorderThreshold!: number;

  @ApiProperty()
  unitCost!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ description: "Whether currentStock is at or below reorderThreshold" })
  isLowStock!: boolean;
}
