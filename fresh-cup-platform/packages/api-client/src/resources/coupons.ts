import type { CouponValidationResult } from "@fresh-cup/types";
import type { ApiClient } from "../client";

export class CouponsResource {
  constructor(private readonly client: ApiClient) {}

  validate(code: string, subtotal: number): Promise<CouponValidationResult> {
    return this.client.request("/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code, subtotal }),
    });
  }
}
