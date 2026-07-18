import { ApiProperty } from "@nestjs/swagger";

export class RecipeIngredientResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  menuItemId!: string;

  @ApiProperty()
  inventoryItemId!: string;

  @ApiProperty()
  quantityPerUnit!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
