import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";

export class UpdateRecipeIngredientDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantityPerUnit!: number;
}
