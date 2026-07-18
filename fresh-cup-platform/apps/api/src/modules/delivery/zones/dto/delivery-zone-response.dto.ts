import { ApiProperty } from "@nestjs/swagger";

export class DeliveryZoneResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  centerLat!: number;

  @ApiProperty()
  centerLng!: number;

  @ApiProperty()
  radiusKm!: number;

  @ApiProperty()
  baseFee!: number;

  @ApiProperty()
  perKmFee!: number;

  @ApiProperty()
  isActive!: boolean;
}
