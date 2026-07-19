import type { Address, CreateAddressInput, UpdateAddressInput } from "@fresh-cup/types";
import type { ApiClient } from "../client";

export class AddressesResource {
  constructor(private readonly client: ApiClient) {}

  list(): Promise<Address[]> {
    return this.client.request("/addresses");
  }

  create(input: CreateAddressInput): Promise<Address> {
    return this.client.request("/addresses", { method: "POST", body: JSON.stringify(input) });
  }

  update(id: string, input: UpdateAddressInput): Promise<Address> {
    return this.client.request(`/addresses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  remove(id: string): Promise<void> {
    return this.client.request(`/addresses/${id}`, { method: "DELETE" });
  }
}
