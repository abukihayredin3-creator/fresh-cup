import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsUUID, Min } from "class-validator";

export class PurchaseOrderLineInputDto {
  @ApiProperty()
  @IsUUID()
  inventoryItemId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantityOrdered!: number;

  @ApiProperty({ description: "ETB minor units, per unit" })
  @IsInt()
  @Min(0)
  unitCost!: number;
}
