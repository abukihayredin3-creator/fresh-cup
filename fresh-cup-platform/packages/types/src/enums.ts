/** Mirrors the Prisma enums in apps/api/prisma/schema.prisma that customer-facing apps need. */

export type UserRole =
  | "CUSTOMER"
  | "STAFF"
  | "MANAGER"
  | "ADMIN"
  | "DRIVER"
  | "CASHIER"
  | "KITCHEN"
  | "WAITER"
  | "INVENTORY_STAFF"
  | "MARKETING_STAFF";

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

export type InventoryUnit = "GRAM" | "MILLILITER" | "UNIT";

export type InventoryTransactionReason =
  "MANUAL_ADJUSTMENT" | "RESTOCK" | "WASTE" | "ORDER_DEDUCTION";

export type PurchaseOrderStatus = "DRAFT" | "SUBMITTED" | "RECEIVED" | "CANCELLED";

export type DeliveryStatus =
  "UNASSIGNED" | "ASSIGNED" | "PICKED_UP" | "EN_ROUTE" | "DELIVERED" | "FAILED";

export type PermissionKey =
  | "MENU_EDIT"
  | "INVENTORY_MANAGE"
  | "PURCHASING_MANAGE"
  | "EMPLOYEE_MANAGE"
  | "MARKETING_MANAGE"
  | "SETTINGS_MANAGE"
  | "REPORTS_VIEW"
  | "FINANCE_VIEW";

export type ShiftStatus = "SCHEDULED" | "COMPLETED" | "MISSED" | "CANCELLED";

export type CampaignChannel = "PUSH" | "EMAIL" | "SMS";

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED";

export type CampaignSegment =
  "ALL_CUSTOMERS" | "ACTIVE_CUSTOMERS" | "INACTIVE_CUSTOMERS" | "VIP_CUSTOMERS";
