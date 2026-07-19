import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsPositive } from "class-validator";

export class UpdateReferralCodeDto {
  @ApiPropertyOptional({ description: "Reward in ETB minor units" })
  @IsOptional()
  @IsInt()
  @IsPositive()
  rewardAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
