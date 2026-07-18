import { ApiProperty } from "@nestjs/swagger";

export class CartItemModifierResponseDto {
  @ApiProperty()
  modifierOptionId!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  priceDelta!: number;
}

export class CartItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: "Base price + selected modifiers, ETB minor units" })
  unitPrice!: number;

  @ApiProperty({ description: "unitPrice * quantity" })
  lineTotal!: number;

  @ApiProperty({ type: [CartItemModifierResponseDto] })
  modifiers!: CartItemModifierResponseDto[];
}

export class CartResponseDto {
  @ApiProperty({ nullable: true, description: "null until the first item is added" })
  id!: string | null;

  @ApiProperty()
  branchId!: string;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];

  @ApiProperty({ description: "Sum of line totals, ETB minor units" })
  subtotal!: number;

  @ApiProperty({ description: "Sum of item quantities" })
  itemCount!: number;
}
