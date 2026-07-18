import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsUUID, Min } from "class-validator";

export class CreateRecipeIngredientDto {
  @ApiProperty()
  @IsUUID()
  menuItemId!: string;

  @ApiProperty()
  @IsUUID()
  inventoryItemId!: string;

  @ApiProperty({
    description: "Quantity of the inventory item's unit consumed per one unit of the menu item",
  })
  @IsNumber()
  @Min(0.001)
  quantityPerUnit!: number;
}
