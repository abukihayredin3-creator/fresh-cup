import { OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateInventoryItemDto } from "./create-inventory-item.dto";

export class UpdateInventoryItemDto extends PartialType(
  OmitType(CreateInventoryItemDto, ["branchId", "currentStock"] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
