import type { PurchaseOrderStatus } from "../enums";

export interface Supplier {
  id: string;
  branchId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

export interface CreateSupplierInput {
  branchId: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export type UpdateSupplierInput = Partial<Omit<CreateSupplierInput, "branchId">> & {
  isActive?: boolean;
};

export interface SupplierAnalytics {
  supplierId: string;
  totalOrders: number;
  receivedOrders: number;
  cancelledOrders: number;
  /** ETB minor units. */
  totalSpend: number;
  /** ETB minor units. */
  totalPaid: number;
  avgLeadTimeDays: number | null;
  fulfillmentRate: number;
}

export interface PurchaseOrderLine {
  id: string;
  inventoryItemId: string;
  quantityOrdered: number;
  /** ETB minor units, per unit. */
  unitCost: number;
  quantityReceived: number | null;
}

export interface PurchaseOrderLineInput {
  inventoryItemId: string;
  quantityOrdered: number;
  unitCost: number;
}

export interface PurchaseOrderPayment {
  id: string;
  purchaseOrderId: string;
  amount: number;
  method: string;
  note: string | null;
  paidAt: string;
}

export interface PurchaseOrder {
  id: string;
  branchId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  createdByUserId: string | null;
  submittedAt: string | null;
  receivedAt: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
  payments: PurchaseOrderPayment[];
  totalPaid: number;
}

export interface CreatePurchaseOrderInput {
  branchId: string;
  supplierId: string;
  notes?: string;
  lines: PurchaseOrderLineInput[];
}

export interface ReceivePurchaseOrderInput {
  lines?: { lineId: string; quantityReceived: number }[];
}

export interface AttachInvoiceInput {
  invoiceNumber?: string;
  invoiceUrl?: string;
}

export interface CreatePurchaseOrderPaymentInput {
  amount: number;
  method: string;
  note?: string;
}

export interface ListPurchaseOrdersParams {
  branchId?: string;
  status?: PurchaseOrderStatus;
  supplierId?: string;
}
