import { ApiProperty } from "@nestjs/swagger";

export class DeliveryTrackingPingResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  lat!: number;

  @ApiProperty()
  lng!: number;

  @ApiProperty()
  recordedAt!: Date;
}
