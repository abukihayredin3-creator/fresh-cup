import { ApiProperty } from "@nestjs/swagger";

export class PurchaseOrderLineResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  inventoryItemId!: string;

  @ApiProperty()
  quantityOrdered!: number;

  @ApiProperty({ description: "ETB minor units, per unit" })
  unitCost!: number;

  @ApiProperty({ nullable: true })
  quantityReceived!: number | null;
}
