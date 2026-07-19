import { ApiProperty } from "@nestjs/swagger";

export class PredictedShortageDto {
  @ApiProperty()
  inventoryItemId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  unit!: string;

  @ApiProperty()
  currentStock!: number;

  @ApiProperty()
  reorderThreshold!: number;

  @ApiProperty({ description: "Average daily consumption over the trailing window" })
  avgDailyConsumption!: number;

  @ApiProperty({
    description: "Estimated days until stock reaches zero, null if consumption is flat",
  })
  daysUntilStockout!: number | null;
}
