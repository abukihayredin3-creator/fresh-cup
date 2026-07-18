import { ApiProperty } from "@nestjs/swagger";

export class DeliveryQuoteResponseDto {
  @ApiProperty({ description: "ETB minor units" })
  fee!: number;

  @ApiProperty()
  etaMinutes!: number;

  @ApiProperty({ description: "Whether a configured delivery zone covers this point" })
  inZone!: boolean;

  @ApiProperty({ nullable: true })
  zoneId!: string | null;

  @ApiProperty({ nullable: true })
  distanceKm!: number | null;
}
