import { ApiProperty } from "@nestjs/swagger";

export class DeliveryHeatmapPointDto {
  @ApiProperty()
  lat!: number;

  @ApiProperty()
  lng!: number;
}

export class DeliveryHeatmapResponseDto {
  @ApiProperty({ type: [DeliveryHeatmapPointDto] })
  points!: DeliveryHeatmapPointDto[];
}
