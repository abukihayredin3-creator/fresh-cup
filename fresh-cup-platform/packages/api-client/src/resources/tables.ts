import type { ResolveTableResult } from "@fresh-cup/types";
import type { ApiClient } from "../client";

export class TablesResource {
  constructor(private readonly client: ApiClient) {}

  /** Resolves a scanned QR token to its branch + table — the only customer-facing tables endpoint. */
  resolve(qrToken: string): Promise<ResolveTableResult> {
    return this.client.request(`/tables/${qrToken}`);
  }
}
