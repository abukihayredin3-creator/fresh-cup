import { ApiProperty } from "@nestjs/swagger";

export class DriverResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ nullable: true })
  branchId!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  vehicleType!: string;

  @ApiProperty({ nullable: true })
  licensePlate!: string | null;

  @ApiProperty()
  isOnline!: boolean;

  @ApiProperty({ nullable: true })
  currentLat!: number | null;

  @ApiProperty({ nullable: true })
  currentLng!: number | null;

  @ApiProperty({ nullable: true })
  lastPingAt!: Date | null;
}
