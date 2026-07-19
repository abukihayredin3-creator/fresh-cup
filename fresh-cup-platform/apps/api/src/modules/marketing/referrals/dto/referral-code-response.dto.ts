import { ApiProperty } from "@nestjs/swagger";

export class ReferralCodeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ description: "ETB minor units" })
  rewardAmount!: number;

  @ApiProperty()
  usesCount!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
