import { ApiProperty } from "@nestjs/swagger";
import { DeliveryStatus } from "@prisma/client";

export class DeliveryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty({ nullable: true })
  driverId!: string | null;

  @ApiProperty({ nullable: true })
  zoneId!: string | null;

  @ApiProperty({ enum: DeliveryStatus })
  status!: DeliveryStatus;

  @ApiProperty({ nullable: true })
  distanceKm!: number | null;

  @ApiProperty({ description: "ETB minor units" })
  fee!: number;

  @ApiProperty({ nullable: true })
  assignedAt!: Date | null;

  @ApiProperty({ nullable: true })
  pickedUpAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
