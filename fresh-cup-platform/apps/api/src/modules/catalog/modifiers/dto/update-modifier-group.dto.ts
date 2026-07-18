import { OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateModifierGroupDto } from "./create-modifier-group.dto";

export class UpdateModifierGroupDto extends PartialType(
  OmitType(CreateModifierGroupDto, ["branchId"] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
