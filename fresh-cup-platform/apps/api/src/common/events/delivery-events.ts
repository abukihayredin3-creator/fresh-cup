import type { DeliveryStatus } from "@prisma/client";

/**
 * In-process domain events for the delivery/dispatch flow, mirroring
 * order-events.ts. Consumed by DeliveryGateway (/ws/delivery real-time
 * updates) — order-status sync is NOT event-driven (DeliveriesService calls
 * OrdersService.markOutForDelivery/markDelivered directly, matching the
 * PaymentsService -> OrdersService.confirmAfterPayment pattern) so that a
 * missing/failed order transition surfaces as an error on the driver's
 * request instead of silently diverging.
 */
export const DELIVERY_EVENTS = {
  ASSIGNED: "delivery.assigned",
  STATUS_CHANGED: "delivery.status_changed",
  LOCATION_UPDATED: "delivery.location_updated",
} as const;

export interface DeliveryAssignedEvent {
  deliveryId: string;
  orderId: string;
  branchId: string;
  driverId: string;
}

export interface DeliveryStatusChangedEvent {
  deliveryId: string;
  orderId: string;
  branchId: string;
  driverId: string | null;
  status: DeliveryStatus;
}

export interface DeliveryLocationUpdatedEvent {
  deliveryId: string | null;
  driverId: string;
  lat: number;
  lng: number;
}
