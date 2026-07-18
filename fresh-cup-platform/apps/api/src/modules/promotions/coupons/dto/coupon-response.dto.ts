import { ApiProperty } from "@nestjs/swagger";
import { DiscountType } from "@prisma/client";

export class CouponResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: DiscountType })
  discountType!: DiscountType;

  @ApiProperty()
  value!: number;

  @ApiProperty({ nullable: true })
  minOrderTotal!: number | null;

  @ApiProperty({ nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ nullable: true })
  maxRedemptions!: number | null;

  @ApiProperty({ nullable: true })
  maxRedemptionsPerUser!: number | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
