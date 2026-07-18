import { OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateCouponDto } from "./create-coupon.dto";

export class UpdateCouponDto extends PartialType(OmitType(CreateCouponDto, ["code"] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
