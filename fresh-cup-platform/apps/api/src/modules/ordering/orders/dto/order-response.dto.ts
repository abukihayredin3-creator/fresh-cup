import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus, OrderType } from "@prisma/client";

export class OrderItemModifierResponseDto {
  @ApiProperty({ nullable: true, description: "null if the option was later deleted" })
  modifierOptionId!: string | null;

  @ApiProperty()
  nameSnapshot!: string;

  @ApiProperty()
  priceDeltaSnapshot!: number;
}

export class OrderItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  nameSnapshot!: string;

  @ApiProperty()
  unitPrice!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  lineTotal!: number;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [OrderItemModifierResponseDto] })
  modifiers!: OrderItemModifierResponseDto[];
}

export class OrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  branchId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: OrderType })
  orderType!: OrderType;

  @ApiProperty({ nullable: true })
  tableId!: string | null;

  @ApiProperty({ nullable: true })
  addressId!: string | null;

  @ApiProperty({ nullable: true })
  deliveryAddressText!: string | null;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  discountTotal!: number;

  @ApiProperty()
  deliveryFee!: number;

  @ApiProperty()
  taxTotal!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ nullable: true })
  couponId!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  placedAt!: Date;

  @ApiProperty({ nullable: true })
  confirmedAt!: Date | null;

  @ApiProperty({ nullable: true })
  readyAt!: Date | null;

  @ApiProperty({ nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];
}
