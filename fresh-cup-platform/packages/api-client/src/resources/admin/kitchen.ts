import type {
  CreateKitchenStationInput,
  KitchenStation,
  PaginatedResult,
  UpdateKitchenStationInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminKitchenResource {
  constructor(private readonly client: ApiClient) {}

  listStations(
    params: PaginationParams & { branchId?: string } = {},
  ): Promise<PaginatedResult<KitchenStation>> {
    return this.client.request(`/admin/kitchen-stations${toQueryString(params)}`);
  }

  getStation(id: string): Promise<KitchenStation> {
    return this.client.request(`/admin/kitchen-stations/${id}`);
  }

  createStation(input: CreateKitchenStationInput): Promise<KitchenStation> {
    return this.client.request("/admin/kitchen-stations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateStation(id: string, input: UpdateKitchenStationInput): Promise<KitchenStation> {
    return this.client.request(`/admin/kitchen-stations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeStation(id: string): Promise<void> {
    return this.client.request(`/admin/kitchen-stations/${id}`, { method: "DELETE" });
  }
}
