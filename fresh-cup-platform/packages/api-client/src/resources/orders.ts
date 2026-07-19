import type {
  CancelOrderInput,
  CreateOrderInput,
  Order,
  OrderStatus,
  OrderStatusHistoryEntry,
  PaginatedResult,
} from "@fresh-cup/types";
import type { ApiClient } from "../client";
import { toQueryString, type PaginationParams } from "../query";

export class OrdersResource {
  constructor(private readonly client: ApiClient) {}

  /** Checkout — creates an order from the caller's cart. Requires a per-attempt idempotency key. */
  checkout(input: CreateOrderInput, idempotencyKey: string): Promise<Order> {
    return this.client.request("/orders", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  list(params: PaginationParams & { status?: OrderStatus } = {}): Promise<PaginatedResult<Order>> {
    return this.client.request(`/orders${toQueryString(params)}`);
  }

  get(id: string): Promise<Order> {
    return this.client.request(`/orders/${id}`);
  }

  getTimeline(id: string): Promise<OrderStatusHistoryEntry[]> {
    return this.client.request(`/orders/${id}/timeline`);
  }

  cancel(id: string, input: CancelOrderInput = {}): Promise<Order> {
    return this.client.request(`/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
