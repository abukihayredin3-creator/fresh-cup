import type { OrderStatus, OrderType } from "./enums";

/** Payloads emitted on the /ws/orders namespace — see apps/api/src/common/events/order-events.ts. */
export interface OrderCreatedEvent {
  orderId: string;
  branchId: string;
  userId: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  branchId: string;
  userId: string;
  orderType: OrderType;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actorUserId: string | null;
}

export interface SubscribeAck {
  ok: boolean;
  error?: "unauthenticated" | "not_found" | "forbidden";
}
