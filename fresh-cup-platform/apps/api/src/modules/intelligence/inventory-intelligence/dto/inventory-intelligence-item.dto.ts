import { ApiProperty } from "@nestjs/swagger";
import { InventoryUnit } from "@prisma/client";

export class InventoryIntelligenceItemDto {
  @ApiProperty()
  inventoryItemId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: InventoryUnit })
  unit!: InventoryUnit;

  @ApiProperty()
  currentStock!: number;

  @ApiProperty()
  reorderThreshold!: number;

  @ApiProperty()
  avgDailyConsumption!: number;

  @ApiProperty({ nullable: true })
  daysUntilStockout!: number | null;

  @ApiProperty({
    description: "0-1, based on historical WASTE-reason ledger volume relative to consumption",
  })
  wasteProbability!: number;

  @ApiProperty({
    nullable: true,
    description:
      "0-1, days-of-supply-on-hand vs shelfLifeDays. Null when the item has no shelfLifeDays set.",
  })
  expiryRisk!: number | null;

  @ApiProperty()
  suggestedReorderQuantity!: number;

  @ApiProperty({ description: "ETB minor units, suggestedReorderQuantity * unitCost" })
  suggestedReorderCost!: number;
}

export class InventoryIntelligenceResponseDto {
  @ApiProperty({ type: [InventoryIntelligenceItemDto] })
  items!: InventoryIntelligenceItemDto[];
}
