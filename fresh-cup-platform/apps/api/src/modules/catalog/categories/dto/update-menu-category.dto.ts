import { OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateMenuCategoryDto } from "./create-menu-category.dto";

export class UpdateMenuCategoryDto extends PartialType(
  OmitType(CreateMenuCategoryDto, ["branchId"] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
