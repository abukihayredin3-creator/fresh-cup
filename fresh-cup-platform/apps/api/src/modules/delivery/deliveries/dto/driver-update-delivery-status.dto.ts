import { ApiProperty } from "@nestjs/swagger";
import { DeliveryStatus } from "@prisma/client";
import { IsIn } from "class-validator";

const DRIVER_SETTABLE_STATUSES = [
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.EN_ROUTE,
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
] as const;

export class DriverUpdateDeliveryStatusDto {
  @ApiProperty({ enum: DRIVER_SETTABLE_STATUSES })
  @IsIn(DRIVER_SETTABLE_STATUSES)
  status!: (typeof DRIVER_SETTABLE_STATUSES)[number];
}
