/**
 * Customer-facing delivery surface only — quoting a fee/ETA before checkout.
 * Live driver GPS tracking (DeliveryTrackingPing) is staff/driver-only in
 * the current API; customers track progress via order status instead (see
 * order.ts's OrderStatusHistoryEntry and the /ws/orders gateway).
 */
export interface DeliveryQuote {
  /** ETB minor units. */
  fee: number;
  etaMinutes: number;
  inZone: boolean;
  zoneId: string | null;
  distanceKm: number | null;
}

export interface DeliveryQuoteInput {
  branchId: string;
  lat: number;
  lng: number;
}
