import type { RestaurantSettings, UpdateSettingsInput } from "@fresh-cup/types";
import type { ApiClient } from "../../client";

export class AdminSettingsResource {
  constructor(private readonly client: ApiClient) {}

  get(): Promise<RestaurantSettings> {
    return this.client.request("/admin/settings");
  }

  update(input: UpdateSettingsInput): Promise<RestaurantSettings> {
    return this.client.request("/admin/settings", { method: "PATCH", body: JSON.stringify(input) });
  }
}
