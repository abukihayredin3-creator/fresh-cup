import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CampaignChannel, CampaignSegment } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: CampaignChannel })
  @IsEnum(CampaignChannel)
  channel!: CampaignChannel;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  message!: string;

  @ApiPropertyOptional({ enum: CampaignSegment, default: CampaignSegment.ALL_CUSTOMERS })
  @IsOptional()
  @IsEnum(CampaignSegment)
  targetSegment?: CampaignSegment;

  @ApiPropertyOptional({ description: "If set, the campaign is created as SCHEDULED" })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
