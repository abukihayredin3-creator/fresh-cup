import type { OrderStatus, OrderType } from "./enums";

export interface OrderItemModifier {
  modifierOptionId: string;
  nameSnapshot: string;
  priceDeltaSnapshot: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  nameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes: string | null;
  stationId: string | null;
  prepTimeSeconds: number;
  modifiers: OrderItemModifier[];
}

export interface Order {
  id: string;
  branchId: string;
  userId: string;
  orderType: OrderType;
  tableId: string | null;
  addressId: string | null;
  deliveryAddressText: string | null;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  taxTotal: number;
  total: number;
  currency: string;
  couponId: string | null;
  notes: string | null;
  placedAt: string;
  preparingAt: string | null;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByUserId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CreateOrderInput {
  branchId: string;
  orderType: OrderType;
  /** Required when orderType is DINE_IN. */
  tableId?: string;
  /** Required when orderType is DELIVERY; must belong to the caller. */
  addressId?: string;
  couponCode?: string;
  notes?: string;
}

export interface CancelOrderInput {
  note?: string;
}

/** The subset of statuses the order graph can still be reached from — see docs/API_DESIGN.md. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED", "DELIVERED"];
