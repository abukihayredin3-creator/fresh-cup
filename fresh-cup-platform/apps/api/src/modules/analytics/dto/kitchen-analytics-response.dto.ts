import { ApiProperty } from "@nestjs/swagger";

export class KitchenStationStatDto {
  @ApiProperty()
  stationId!: string;

  @ApiProperty()
  stationName!: string;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty({ description: "Average of each item's snapshotted estimated prep time" })
  avgEstimatedPrepSeconds!: number;
}

export class KitchenAnalyticsResponseDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty({ description: "Orders with both preparingAt and readyAt set in the range" })
  completedOrders!: number;

  @ApiProperty({ nullable: true, description: "Average readyAt - preparingAt, in seconds" })
  avgPrepSeconds!: number | null;

  @ApiProperty({ type: [KitchenStationStatDto] })
  byStation!: KitchenStationStatDto[];
}
