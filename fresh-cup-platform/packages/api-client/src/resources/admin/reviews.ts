import type { ListReviewsParams, PaginatedResult, ProductReview } from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminReviewsResource {
  constructor(private readonly client: ApiClient) {}

  list(params: PaginationParams & ListReviewsParams = {}): Promise<PaginatedResult<ProductReview>> {
    return this.client.request(`/admin/reviews${toQueryString(params)}`);
  }

  remove(id: string): Promise<void> {
    return this.client.request(`/admin/reviews/${id}`, { method: "DELETE" });
  }
}
