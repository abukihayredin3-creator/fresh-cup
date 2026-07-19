import type {
  CreateDeliveryZoneInput,
  CreateDriverInput,
  DeliveryAdmin,
  DeliveryQuote,
  DeliveryQuoteInput,
  DeliveryTrackingPing,
  DeliveryZoneAdmin,
  Driver,
  ListDeliveriesParams,
  PaginatedResult,
  UpdateDeliveryZoneInput,
  UpdateDriverInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminDeliveryResource {
  constructor(private readonly client: ApiClient) {}

  // Drivers
  listDrivers(
    params: PaginationParams & { branchId?: string } = {},
  ): Promise<PaginatedResult<Driver>> {
    return this.client.request(`/admin/drivers${toQueryString(params)}`);
  }

  getDriver(id: string): Promise<Driver> {
    return this.client.request(`/admin/drivers/${id}`);
  }

  createDriver(input: CreateDriverInput): Promise<Driver> {
    return this.client.request("/admin/drivers", { method: "POST", body: JSON.stringify(input) });
  }

  updateDriver(id: string, input: UpdateDriverInput): Promise<Driver> {
    return this.client.request(`/admin/drivers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  // Zones
  listZones(
    params: PaginationParams & { branchId?: string } = {},
  ): Promise<PaginatedResult<DeliveryZoneAdmin>> {
    return this.client.request(`/admin/delivery-zones${toQueryString(params)}`);
  }

  getZone(id: string): Promise<DeliveryZoneAdmin> {
    return this.client.request(`/admin/delivery-zones/${id}`);
  }

  createZone(input: CreateDeliveryZoneInput): Promise<DeliveryZoneAdmin> {
    return this.client.request("/admin/delivery-zones", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateZone(id: string, input: UpdateDeliveryZoneInput): Promise<DeliveryZoneAdmin> {
    return this.client.request(`/admin/delivery-zones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeZone(id: string): Promise<void> {
    return this.client.request(`/admin/delivery-zones/${id}`, { method: "DELETE" });
  }

  quote(input: DeliveryQuoteInput): Promise<DeliveryQuote> {
    return this.client.request("/admin/delivery-zones/quote", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // Deliveries
  listDeliveries(
    params: PaginationParams & ListDeliveriesParams = {},
  ): Promise<PaginatedResult<DeliveryAdmin>> {
    return this.client.request(`/admin/deliveries${toQueryString(params)}`);
  }

  getDelivery(id: string): Promise<DeliveryAdmin> {
    return this.client.request(`/admin/deliveries/${id}`);
  }

  getTracking(id: string): Promise<DeliveryTrackingPing[]> {
    return this.client.request(`/admin/deliveries/${id}/tracking`);
  }

  assignDriver(id: string, driverId: string): Promise<DeliveryAdmin> {
    return this.client.request(`/admin/deliveries/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ driverId }),
    });
  }
}
