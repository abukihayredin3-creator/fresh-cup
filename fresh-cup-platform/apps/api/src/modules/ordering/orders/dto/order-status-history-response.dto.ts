import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";

export class OrderStatusHistoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: OrderStatus, nullable: true })
  fromStatus!: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus })
  toStatus!: OrderStatus;

  @ApiProperty({ nullable: true })
  changedByUserId!: string | null;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
