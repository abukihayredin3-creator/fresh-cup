import { ApiProperty } from "@nestjs/swagger";

export class ItemAnalyticsEntryDto {
  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  quantitySold!: number;

  @ApiProperty({ description: "ETB minor units" })
  revenue!: number;
}

export class ItemAnalyticsResponseDto {
  @ApiProperty({ type: [ItemAnalyticsEntryDto] })
  items!: ItemAnalyticsEntryDto[];
}
