import type {
  CreateDeliveryZoneInput,
  CreateDriverInput,
  ListDeliveriesParams,
  UpdateDeliveryZoneInput,
  UpdateDriverInput,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useDrivers(params: PaginationParams & { branchId?: string }) {
  return useQuery({
    queryKey: ["admin-drivers", params],
    queryFn: () => api.admin.delivery.listDrivers({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ["admin-driver", id],
    queryFn: () => api.admin.delivery.getDriver(id),
    enabled: Boolean(id),
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDriverInput) => api.admin.delivery.createDriver(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-drivers"] }),
  });
}

export function useUpdateDriver(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDriverInput) => api.admin.delivery.updateDriver(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-driver", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    },
  });
}

export function useDeliveryZones(params: PaginationParams & { branchId?: string }) {
  return useQuery({
    queryKey: ["admin-delivery-zones", params],
    queryFn: () => api.admin.delivery.listZones({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useCreateDeliveryZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDeliveryZoneInput) => api.admin.delivery.createZone(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] }),
  });
}

export function useUpdateDeliveryZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDeliveryZoneInput }) =>
      api.admin.delivery.updateZone(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] }),
  });
}

export function useRemoveDeliveryZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.delivery.removeZone(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] }),
  });
}

export function useDeliveries(params: PaginationParams & ListDeliveriesParams) {
  return useQuery({
    queryKey: ["admin-deliveries", params],
    queryFn: () => api.admin.delivery.listDeliveries({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useDelivery(id: string) {
  return useQuery({
    queryKey: ["admin-delivery", id],
    queryFn: () => api.admin.delivery.getDelivery(id),
    enabled: Boolean(id),
  });
}

export function useDeliveryTracking(id: string) {
  return useQuery({
    queryKey: ["admin-delivery-tracking", id],
    queryFn: () => api.admin.delivery.getTracking(id),
    enabled: Boolean(id),
  });
}

export function useAssignDriver(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (driverId: string) => api.admin.delivery.assignDriver(id, driverId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-delivery", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] });
    },
  });
}
