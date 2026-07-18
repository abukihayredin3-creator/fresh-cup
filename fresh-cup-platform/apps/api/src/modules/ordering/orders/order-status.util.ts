import { BadRequestException } from "@nestjs/common";
import { OrderStatus, OrderType } from "@prisma/client";

/**
 * pending_payment -> confirmed -> preparing -> ready -> {completed | out_for_delivery -> delivered -> completed}
 * any non-terminal state -> cancelled. See docs/API_DESIGN.md.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(`Cannot transition an order from ${from} to ${to}`);
  }
}

/** on top of the base graph: out_for_delivery/delivered only apply to delivery orders. */
export function assertOrderTypeAllowsStatus(
  orderType: OrderType,
  from: OrderStatus,
  to: OrderStatus,
): void {
  const isDelivery = orderType === OrderType.DELIVERY;

  if ((to === OrderStatus.OUT_FOR_DELIVERY || to === OrderStatus.DELIVERED) && !isDelivery) {
    throw new BadRequestException(`${to} only applies to delivery orders`);
  }
  if (from === OrderStatus.READY && to === OrderStatus.COMPLETED && isDelivery) {
    throw new BadRequestException(
      "Delivery orders must pass through out_for_delivery and delivered before completed",
    );
  }
}

export function canCustomerCancelFrom(status: OrderStatus): boolean {
  return status === OrderStatus.PENDING_PAYMENT || status === OrderStatus.CONFIRMED;
}
