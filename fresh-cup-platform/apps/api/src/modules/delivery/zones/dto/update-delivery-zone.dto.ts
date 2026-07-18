import { OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateDeliveryZoneDto } from "./create-delivery-zone.dto";

export class UpdateDeliveryZoneDto extends PartialType(
  OmitType(CreateDeliveryZoneDto, ["branchId"] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
