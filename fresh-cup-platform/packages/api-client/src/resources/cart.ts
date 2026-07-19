import type { AddCartItemInput, Cart, UpdateCartItemInput } from "@fresh-cup/types";
import type { ApiClient } from "../client";
import { toQueryString } from "../query";

export class CartResource {
  constructor(private readonly client: ApiClient) {}

  get(branchId: string): Promise<Cart> {
    return this.client.request(`/cart${toQueryString({ branchId })}`);
  }

  addItem(input: AddCartItemInput): Promise<Cart> {
    return this.client.request("/cart/items", { method: "POST", body: JSON.stringify(input) });
  }

  updateItem(itemId: string, input: UpdateCartItemInput): Promise<Cart> {
    return this.client.request(`/cart/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeItem(itemId: string): Promise<Cart> {
    return this.client.request(`/cart/items/${itemId}`, { method: "DELETE" });
  }

  clear(branchId: string): Promise<void> {
    return this.client.request(`/cart${toQueryString({ branchId })}`, { method: "DELETE" });
  }
}
