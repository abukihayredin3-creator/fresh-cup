import type { OrderStatus } from "@fresh-cup/types";
import { Badge, type BadgeProps } from "./Badge";

const STATUS_TONE: Record<OrderStatus, NonNullable<BadgeProps["tone"]>> = {
  PENDING_PAYMENT: "neutral",
  CONFIRMED: "orange",
  PREPARING: "orange",
  READY: "green",
  OUT_FOR_DELIVERY: "orange",
  DELIVERED: "green",
  COMPLETED: "green",
  CANCELLED: "error",
};

export interface StatusBadgeProps {
  status: OrderStatus;
  /** Localized label — packages/ui doesn't own copy, callers pass the translated string. */
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {label}
    </Badge>
  );
}
