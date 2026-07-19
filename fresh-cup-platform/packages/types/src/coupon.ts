import type { DiscountType } from "./enums";

export interface CouponValidationResult {
  code: string;
  discountType: DiscountType;
  /** ETB minor units. */
  discountAmount: number;
  freeDelivery: boolean;
}
