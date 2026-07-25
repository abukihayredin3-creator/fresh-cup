import { ApiProperty } from "@nestjs/swagger";
import { MenuCategoryResponseDto } from "../../categories/dto/menu-category-response.dto";
import { MenuItemResponseDto } from "../../menu-items/dto/menu-item-response.dto";

export class MenuBrowseResponseDto {
  @ApiProperty({ nullable: true, description: "null when no active branch exists yet" })
  branchId!: string | null;

  @ApiProperty({ type: [MenuCategoryResponseDto] })
  categories!: MenuCategoryResponseDto[];

  @ApiProperty({ type: [MenuItemResponseDto] })
  items!: MenuItemResponseDto[];
}
