import { ApiProperty } from "@nestjs/swagger";

export class WasteReportItemDto {
  @ApiProperty()
  inventoryItemId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  unit!: string;

  @ApiProperty({ description: "Total quantity wasted (positive number)" })
  totalWasted!: number;

  @ApiProperty({ description: "Estimated cost of wasted stock, in ETB minor units" })
  estimatedCost!: number;

  @ApiProperty()
  transactionCount!: number;
}

export class WasteReportResponseDto {
  @ApiProperty({ type: [WasteReportItemDto] })
  items!: WasteReportItemDto[];

  @ApiProperty({ description: "Sum of estimatedCost across all items, in ETB minor units" })
  totalEstimatedCost!: number;
}
