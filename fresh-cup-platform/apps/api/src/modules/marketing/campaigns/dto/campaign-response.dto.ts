import { ApiProperty } from "@nestjs/swagger";
import { CampaignChannel, CampaignSegment, CampaignStatus } from "@prisma/client";

export class CampaignResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: CampaignChannel })
  channel!: CampaignChannel;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: CampaignSegment })
  targetSegment!: CampaignSegment;

  @ApiProperty({ enum: CampaignStatus })
  status!: CampaignStatus;

  @ApiProperty({ nullable: true })
  scheduledAt!: Date | null;

  @ApiProperty({ nullable: true })
  sentAt!: Date | null;

  @ApiProperty({ nullable: true })
  recipientCount!: number | null;

  @ApiProperty()
  createdAt!: Date;
}
