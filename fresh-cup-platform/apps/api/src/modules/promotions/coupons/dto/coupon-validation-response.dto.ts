import { ApiProperty } from "@nestjs/swagger";
import { DiscountType } from "@prisma/client";

export class CouponValidationResponseDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: DiscountType })
  discountType!: DiscountType;

  @ApiProperty({ description: "Amount to subtract from subtotal, ETB minor units" })
  discountAmount!: number;

  @ApiProperty({ description: "Whether this coupon waives the delivery fee" })
  freeDelivery!: boolean;
}
