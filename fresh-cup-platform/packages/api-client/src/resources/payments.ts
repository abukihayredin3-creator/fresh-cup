import type { InitiatePaymentInput, InitiatePaymentResult } from "@fresh-cup/types";
import type { ApiClient } from "../client";

export class PaymentsResource {
  constructor(private readonly client: ApiClient) {}

  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    return this.client.request("/payments/initiate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
