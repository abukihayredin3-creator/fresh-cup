import type {
  AttachInvoiceInput,
  CreatePurchaseOrderInput,
  CreatePurchaseOrderPaymentInput,
  CreateSupplierInput,
  ListPurchaseOrdersParams,
  PaginatedResult,
  PurchaseOrder,
  ReceivePurchaseOrderInput,
  Supplier,
  SupplierAnalytics,
  UpdateSupplierInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminPurchasingResource {
  constructor(private readonly client: ApiClient) {}

  // Suppliers
  listSuppliers(
    params: PaginationParams & { branchId?: string } = {},
  ): Promise<PaginatedResult<Supplier>> {
    return this.client.request(`/admin/suppliers${toQueryString(params)}`);
  }

  getSupplier(id: string): Promise<Supplier> {
    return this.client.request(`/admin/suppliers/${id}`);
  }

  supplierAnalytics(id: string): Promise<SupplierAnalytics> {
    return this.client.request(`/admin/suppliers/${id}/analytics`);
  }

  createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    return this.client.request("/admin/suppliers", { method: "POST", body: JSON.stringify(input) });
  }

  updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
    return this.client.request(`/admin/suppliers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  removeSupplier(id: string): Promise<void> {
    return this.client.request(`/admin/suppliers/${id}`, { method: "DELETE" });
  }

  // Purchase orders
  listPurchaseOrders(
    params: PaginationParams & ListPurchaseOrdersParams = {},
  ): Promise<PaginatedResult<PurchaseOrder>> {
    return this.client.request(`/admin/purchase-orders${toQueryString(params)}`);
  }

  getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    return this.client.request(`/admin/purchase-orders/${id}`);
  }

  createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
    return this.client.request("/admin/purchase-orders", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
    return this.client.request(`/admin/purchase-orders/${id}/submit`, { method: "POST" });
  }

  receivePurchaseOrder(id: string, input: ReceivePurchaseOrderInput = {}): Promise<PurchaseOrder> {
    return this.client.request(`/admin/purchase-orders/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
    return this.client.request(`/admin/purchase-orders/${id}/cancel`, { method: "POST" });
  }

  attachInvoice(id: string, input: AttachInvoiceInput): Promise<PurchaseOrder> {
    return this.client.request(`/admin/purchase-orders/${id}/invoice`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  addPayment(id: string, input: CreatePurchaseOrderPaymentInput): Promise<PurchaseOrder> {
    return this.client.request(`/admin/purchase-orders/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
