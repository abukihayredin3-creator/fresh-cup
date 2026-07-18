import { OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateKitchenStationDto } from "./create-kitchen-station.dto";

export class UpdateKitchenStationDto extends PartialType(
  OmitType(CreateKitchenStationDto, ["branchId"] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
