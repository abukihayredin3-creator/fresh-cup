import { ApiProperty } from "@nestjs/swagger";

export class ReferralRedemptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  referralCodeId!: string;

  @ApiProperty()
  referredUserId!: string;

  @ApiProperty({ nullable: true })
  orderId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
