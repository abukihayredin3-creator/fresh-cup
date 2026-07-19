import { ApiPropertyOptional } from "@nestjs/swagger";
import { CampaignSegment } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  message?: string;

  @ApiPropertyOptional({ enum: CampaignSegment })
  @IsOptional()
  @IsEnum(CampaignSegment)
  targetSegment?: CampaignSegment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
