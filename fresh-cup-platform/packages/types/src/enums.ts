/** Mirrors the Prisma enums in apps/api/prisma/schema.prisma that customer-facing apps need. */

export type UserRole = "CUSTOMER" | "STAFF" | "MANAGER" | "DRIVER" | "ADMIN";

export type OrderType = "DINE_IN" | "PICKUP" | "DELIVERY";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type ModifierSelectionType = "SINGLE" | "MULTIPLE";

export type PaymentProvider = "CHAPA" | "CASH";

export type PaymentMethod = "TELEBIRR" | "CBE_BIRR" | "HELLOCASH" | "AMOLE" | "CARD" | "CASH";

export type PaymentStatus = "INITIATED" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export type DiscountType = "PERCENT" | "AMOUNT" | "FREE_DELIVERY";

export type LoyaltyReason = "ORDER_EARNED" | "MANUAL_ADJUSTMENT";

export type PushPlatform = "IOS" | "ANDROID" | "WEB";
