import type { LoyaltyMe } from "@fresh-cup/types";
import type { ApiClient } from "../client";
import { toQueryString, type PaginationParams } from "../query";

export class LoyaltyResource {
  constructor(private readonly client: ApiClient) {}

  me(params: PaginationParams = {}): Promise<LoyaltyMe> {
    return this.client.request(`/loyalty/me${toQueryString(params)}`);
  }
}
