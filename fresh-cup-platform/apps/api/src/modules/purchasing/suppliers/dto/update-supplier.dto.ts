import { OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateSupplierDto } from "./create-supplier.dto";

export class UpdateSupplierDto extends PartialType(
  OmitType(CreateSupplierDto, ["branchId"] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
