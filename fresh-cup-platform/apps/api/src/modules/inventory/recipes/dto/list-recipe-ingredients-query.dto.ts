import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../../common/dto/pagination-query.dto";

export class ListRecipeIngredientsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  menuItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;
}
