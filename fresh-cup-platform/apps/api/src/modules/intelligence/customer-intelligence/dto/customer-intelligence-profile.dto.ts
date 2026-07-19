import { ApiProperty } from "@nestjs/swagger";
import { RfmScoreDto } from "./customer-segment.dto";

export class FavoriteCategoryDto {
  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  orderCount!: number;
}

export class CouponEffectivenessDto {
  @ApiProperty()
  ordersWithCoupon!: number;

  @ApiProperty()
  ordersWithoutCoupon!: number;

  @ApiProperty({ description: "ETB minor units" })
  avgOrderValueWithCoupon!: number;

  @ApiProperty({ description: "ETB minor units" })
  avgOrderValueWithoutCoupon!: number;
}

export class LoyaltyProgressionDto {
  @ApiProperty()
  currentBalance!: number;

  @ApiProperty({ description: "Sum of all positive point accruals, ever" })
  lifetimeEarned!: number;

  @ApiProperty({ description: "Bronze | Silver | Gold, based on lifetime points earned" })
  tier!: string;

  @ApiProperty({ description: "Points needed to reach the next tier, null if already top tier" })
  pointsToNextTier!: number | null;
}

export class CustomerIntelligenceProfileDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  recencyDays!: number;

  @ApiProperty()
  ordersCount!: number;

  @ApiProperty({ description: "ETB minor units" })
  totalSpend!: number;

  @ApiProperty({ description: "ETB minor units" })
  avgOrderValue!: number;

  @ApiProperty({
    nullable: true,
    description: "Average days between orders, null with fewer than 2 orders",
  })
  purchaseFrequencyDays!: number | null;

  @ApiProperty({ type: RfmScoreDto })
  rfm!: RfmScoreDto;

  @ApiProperty()
  segment!: string;

  @ApiProperty({ description: "0-1, higher means more likely to churn" })
  churnRisk!: number;

  @ApiProperty({ description: "ETB minor units, predicted lifetime value" })
  predictedLtv!: number;

  @ApiProperty({ type: [FavoriteCategoryDto] })
  favoriteCategories!: FavoriteCategoryDto[];

  @ApiProperty({ nullable: true, minimum: 0, maximum: 23 })
  preferredOrderHour!: number | null;

  @ApiProperty({ nullable: true })
  preferredPaymentMethod!: string | null;

  @ApiProperty({ type: CouponEffectivenessDto })
  couponEffectiveness!: CouponEffectivenessDto;

  @ApiProperty({ type: LoyaltyProgressionDto })
  loyaltyProgression!: LoyaltyProgressionDto;
}
