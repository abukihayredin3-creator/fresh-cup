import { ApiProperty } from "@nestjs/swagger";

export class DeliveryZoneStatDto {
  @ApiProperty({ nullable: true })
  zoneId!: string | null;

  @ApiProperty()
  zoneName!: string;

  @ApiProperty()
  deliveredCount!: number;

  @ApiProperty({ description: "Average delivery fee, in ETB minor units" })
  avgFee!: number;
}

export class DeliveryAnalyticsResponseDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty()
  totalDeliveries!: number;

  @ApiProperty()
  completedDeliveries!: number;

  @ApiProperty({ nullable: true, description: "Average assignedAt -> deliveredAt, in minutes" })
  avgDeliveryMinutes!: number | null;

  @ApiProperty({ type: [DeliveryZoneStatDto] })
  byZone!: DeliveryZoneStatDto[];
}
