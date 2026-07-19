import type {
  AdjustStockInput,
  CreateInventoryItemInput,
  InventoryTransactionReason,
  UpdateInventoryItemInput,
  WasteReportParams,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useInventoryItems(params: PaginationParams & { branchId?: string }) {
  return useQuery({
    queryKey: ["admin-inventory", params],
    queryFn: () => api.admin.inventory.list({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useInventoryItem(id: string) {
  return useQuery({
    queryKey: ["admin-inventory-item", id],
    queryFn: () => api.admin.inventory.get(id),
    enabled: Boolean(id),
  });
}

export function useLowStockItems(branchId?: string) {
  return useQuery({
    queryKey: ["admin-inventory-low-stock", branchId],
    queryFn: () => api.admin.inventory.lowStock(branchId),
  });
}

export function useWasteReport(params: WasteReportParams) {
  return useQuery({
    queryKey: ["admin-inventory-waste-report", params],
    queryFn: () => api.admin.inventory.wasteReport(params),
  });
}

export function usePredictedShortages(branchId?: string) {
  return useQuery({
    queryKey: ["admin-inventory-shortages", branchId],
    queryFn: () => api.admin.inventory.predictedShortages(branchId),
  });
}

export function useInventoryHistory(
  id: string,
  params: PaginationParams & { reason?: InventoryTransactionReason } = {},
) {
  return useQuery({
    queryKey: ["admin-inventory-history", id, params],
    queryFn: () => api.admin.inventory.history(id, { ...params, limit: params.limit ?? 50 }),
    enabled: Boolean(id),
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInventoryItemInput) => api.admin.inventory.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] }),
  });
}

export function useUpdateInventoryItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInventoryItemInput) => api.admin.inventory.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory-item", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
    },
  });
}

export function useAdjustStock(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustStockInput) => api.admin.inventory.adjust(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory-item", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inventory-history", id] });
    },
  });
}
