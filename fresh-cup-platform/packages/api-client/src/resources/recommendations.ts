import type { Recommendations } from "@fresh-cup/types";
import type { ApiClient } from "../client";
import { toQueryString } from "../query";

/** Phase 6 — public recommendation surfaces (work for anonymous browsing, not just logged-in customers). */
export class RecommendationsResource {
  constructor(private readonly client: ApiClient) {}

  frequentlyBoughtTogether(menuItemId: string, limit?: number): Promise<Recommendations> {
    return this.client.request(
      `/recommendations/frequently-bought-together/${menuItemId}${toQueryString({ limit })}`,
    );
  }

  similar(menuItemId: string, limit?: number): Promise<Recommendations> {
    return this.client.request(`/recommendations/similar/${menuItemId}${toQueryString({ limit })}`);
  }

  upsellCrossSell(menuItemId: string, limit?: number): Promise<Recommendations> {
    return this.client.request(
      `/recommendations/upsell-cross-sell/${menuItemId}${toQueryString({ limit })}`,
    );
  }

  forCart(menuItemIds: string[], limit?: number): Promise<Recommendations> {
    return this.client.request(
      `/recommendations/cart${toQueryString({ menuItemIds: menuItemIds.join(","), limit })}`,
    );
  }

  trending(params: { branchId?: string; limit?: number } = {}): Promise<Recommendations> {
    return this.client.request(`/recommendations/trending${toQueryString(params)}`);
  }

  seasonal(params: { branchId?: string; limit?: number } = {}): Promise<Recommendations> {
    return this.client.request(`/recommendations/seasonal${toQueryString(params)}`);
  }

  /** Requires a logged-in customer — collaborative filtering + fallback over their order history. */
  personalized(params: { branchId?: string; limit?: number } = {}): Promise<Recommendations> {
    return this.client.request(`/recommendations/personalized${toQueryString(params)}`);
  }
}
