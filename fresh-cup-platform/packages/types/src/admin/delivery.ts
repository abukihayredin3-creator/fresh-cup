import type { DeliveryStatus } from "../enums";

export interface Driver {
  id: string;
  email: string | null;
  fullName: string;
  branchId: string | null;
  isActive: boolean;
  vehicleType: string;
  licensePlate: string | null;
  isOnline: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastPingAt: string | null;
}

export interface CreateDriverInput {
  branchId: string;
  email: string;
  password: string;
  fullName: string;
  vehicleType: string;
  licensePlate?: string;
}

export interface UpdateDriverInput {
  fullName?: string;
  vehicleType?: string;
  licensePlate?: string;
  isActive?: boolean;
}

export interface DeliveryZoneAdmin {
  id: string;
  branchId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  /** ETB minor units. */
  baseFee: number;
  /** ETB minor units per km. */
  perKmFee: number;
  isActive: boolean;
}

export interface CreateDeliveryZoneInput {
  branchId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  baseFee: number;
  perKmFee?: number;
}

export type UpdateDeliveryZoneInput = Partial<Omit<CreateDeliveryZoneInput, "branchId">> & {
  isActive?: boolean;
};

export interface DeliveryAdmin {
  id: string;
  orderId: string;
  branchId: string;
  driverId: string | null;
  zoneId: string | null;
  status: DeliveryStatus;
  distanceKm: number | null;
  /** ETB minor units. */
  fee: number;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListDeliveriesParams {
  branchId?: string;
  status?: DeliveryStatus;
  driverId?: string;
}

export interface DeliveryTrackingPing {
  id: string;
  lat: number;
  lng: number;
  recordedAt: string;
}
