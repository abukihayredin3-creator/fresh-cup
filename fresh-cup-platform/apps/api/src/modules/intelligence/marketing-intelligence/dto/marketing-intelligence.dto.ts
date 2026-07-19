import { ApiProperty } from "@nestjs/swagger";

export class CampaignPerformanceDto {
  @ApiProperty()
  campaignId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  channel!: string;

  @ApiProperty({ nullable: true })
  recipientCount!: number | null;

  @ApiProperty({ nullable: true })
  sentAt!: string | null;

  @ApiProperty({
    nullable: true,
    description:
      "% change in order volume in the 72h after send vs the 72h before, null until sent",
  })
  estimatedOrderLiftPercent!: number | null;
}

export class CouponOptimizationDto {
  @ApiProperty()
  couponId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  redemptionCount!: number;

  @ApiProperty({ nullable: true })
  maxRedemptions!: number | null;

  @ApiProperty({ description: "ETB minor units" })
  avgOrderValueWithCoupon!: number;

  @ApiProperty({ description: "ETB minor units" })
  avgOrderValueBaseline!: number;

  @ApiProperty({ description: "underused | effective | saturated" })
  recommendation!: string;
}

export class ReferralOptimizationDto {
  @ApiProperty()
  totalCodesIssued!: number;

  @ApiProperty()
  totalRedemptions!: number;

  @ApiProperty({ description: "0-1" })
  conversionRate!: number;

  @ApiProperty({ description: "ETB minor units" })
  avgRewardCostPerAcquisition!: number;

  @ApiProperty({ type: [Object], description: "Top referrers: { userId, fullName, usesCount }" })
  topReferrers!: { userId: string; fullName: string; usesCount: number }[];
}

export class LoyaltyOptimizationDto {
  @ApiProperty()
  activeMembers!: number;

  @ApiProperty()
  avgBalance!: number;

  @ApiProperty({
    description: "Members within reach of the next tier — good targets for a small push campaign",
  })
  membersNearNextTier!: number;

  @ApiProperty({ description: "Total unredeemed points across all members" })
  totalUnredeemedPoints!: number;
}

export class TargetSuggestionDto {
  @ApiProperty()
  segment!: string;

  @ApiProperty()
  customerCount!: number;

  @ApiProperty()
  suggestion!: string;

  @ApiProperty({ description: "PUSH | EMAIL | SMS, best-fit channel for this suggestion" })
  recommendedChannel!: string;
}
