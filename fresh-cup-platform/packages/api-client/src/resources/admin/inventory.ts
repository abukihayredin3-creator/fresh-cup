import type {
  AdjustStockInput,
  CreateInventoryItemInput,
  InventoryItem,
  InventoryTransaction,
  InventoryTransactionReason,
  PaginatedResult,
  PredictedShortage,
  UpdateInventoryItemInput,
  WasteReport,
  WasteReportParams,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminInventoryResource {
  constructor(private readonly client: ApiClient) {}

  list(
    params: PaginationParams & { branchId?: string } = {},
  ): Promise<PaginatedResult<InventoryItem>> {
    return this.client.request(`/admin/inventory${toQueryString(params)}`);
  }

  lowStock(branchId?: string): Promise<InventoryItem[]> {
    return this.client.request(`/admin/inventory/low-stock${toQueryString({ branchId })}`);
  }

  wasteReport(params: WasteReportParams = {}): Promise<WasteReport> {
    return this.client.request(`/admin/inventory/waste-report${toQueryString(params)}`);
  }

  predictedShortages(branchId?: string): Promise<PredictedShortage[]> {
    return this.client.request(
      `/admin/inventory/predicted-shortages${toQueryString({ branchId })}`,
    );
  }

  get(id: string): Promise<InventoryItem> {
    return this.client.request(`/admin/inventory/${id}`);
  }

  history(
    id: string,
    params: PaginationParams & { reason?: InventoryTransactionReason } = {},
  ): Promise<PaginatedResult<InventoryTransaction>> {
    return this.client.request(`/admin/inventory/${id}/history${toQueryString(params)}`);
  }

  create(input: CreateInventoryItemInput): Promise<InventoryItem> {
    return this.client.request("/admin/inventory", { method: "POST", body: JSON.stringify(input) });
  }

  update(id: string, input: UpdateInventoryItemInput): Promise<InventoryItem> {
    return this.client.request(`/admin/inventory/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  adjust(id: string, input: AdjustStockInput): Promise<InventoryItem> {
    return this.client.request(`/admin/inventory/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
