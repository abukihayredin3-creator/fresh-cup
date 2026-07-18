import type { OrderStatus, OrderType } from "@prisma/client";

/**
 * In-process domain events (NestJS EventEmitter2) — the cross-cutting hook
 * point ARCHITECTURE.md describes: order.paid triggers Loyalty to accrue
 * points and, in a later phase, Inventory to deduct stock, without
 * Ordering/Payments depending on either directly.
 *
 * Dispatch is in-process and non-durable, via `emitAsync` — the emitter
 * awaits every listener before the triggering request resolves, so a
 * response never claims "payment confirmed" before loyalty accrual and
 * notifications have actually run. A durable BullMQ-backed queue (the
 * `queue/` directory scaffolded in Phase 0) is the natural next step once a
 * provider actually makes a retryable network call — today's console-log
 * providers have no failure mode worth queuing for, and awaited dispatch
 * keeps behavior deterministic (for callers and for e2e tests alike)
 * without that extra infrastructure.
 */
export const ORDER_EVENTS = {
  CREATED: "order.created",
  STATUS_CHANGED: "order.status_changed",
  PAID: "order.paid",
} as const;

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

export interface OrderPaidEvent {
  orderId: string;
  branchId: string;
  userId: string;
  total: number;
  currency: string;
}
