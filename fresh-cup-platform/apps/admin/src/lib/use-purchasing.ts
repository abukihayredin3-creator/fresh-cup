import type {
  AttachInvoiceInput,
  CreatePurchaseOrderInput,
  CreatePurchaseOrderPaymentInput,
  CreateSupplierInput,
  ListPurchaseOrdersParams,
  ReceivePurchaseOrderInput,
  UpdateSupplierInput,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useSuppliers(params: PaginationParams & { branchId?: string }) {
  return useQuery({
    queryKey: ["admin-suppliers", params],
    queryFn: () => api.admin.purchasing.listSuppliers({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: ["admin-supplier", id],
    queryFn: () => api.admin.purchasing.getSupplier(id),
    enabled: Boolean(id),
  });
}

export function useSupplierAnalytics(id: string) {
  return useQuery({
    queryKey: ["admin-supplier-analytics", id],
    queryFn: () => api.admin.purchasing.supplierAnalytics(id),
    enabled: Boolean(id),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupplierInput) => api.admin.purchasing.createSupplier(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-suppliers"] }),
  });
}

export function useUpdateSupplier(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSupplierInput) => api.admin.purchasing.updateSupplier(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-supplier", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-suppliers"] });
    },
  });
}

export function useRemoveSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.purchasing.removeSupplier(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-suppliers"] }),
  });
}

export function usePurchaseOrders(params: PaginationParams & ListPurchaseOrdersParams) {
  return useQuery({
    queryKey: ["admin-purchase-orders", params],
    queryFn: () =>
      api.admin.purchasing.listPurchaseOrders({ ...params, limit: params.limit ?? 50 }),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ["admin-purchase-order", id],
    queryFn: () => api.admin.purchasing.getPurchaseOrder(id),
    enabled: Boolean(id),
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) =>
      api.admin.purchasing.createPurchaseOrder(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-purchase-orders"] }),
  });
}

function invalidatePurchaseOrder(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.invalidateQueries({ queryKey: ["admin-purchase-order", id] });
  void queryClient.invalidateQueries({ queryKey: ["admin-purchase-orders"] });
}

export function useSubmitPurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.admin.purchasing.submitPurchaseOrder(id),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useReceivePurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceivePurchaseOrderInput = {}) =>
      api.admin.purchasing.receivePurchaseOrder(id, input),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useCancelPurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.admin.purchasing.cancelPurchaseOrder(id),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useAttachInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AttachInvoiceInput) => api.admin.purchasing.attachInvoice(id, input),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}

export function useAddPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseOrderPaymentInput) =>
      api.admin.purchasing.addPayment(id, input),
    onSuccess: () => invalidatePurchaseOrder(queryClient, id),
  });
}
