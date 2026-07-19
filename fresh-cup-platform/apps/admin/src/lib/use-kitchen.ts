import type { CreateKitchenStationInput, UpdateKitchenStationInput } from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useKitchenStations(params: PaginationParams & { branchId?: string }) {
  return useQuery({
    queryKey: ["admin-kitchen-stations", params],
    queryFn: () => api.admin.kitchen.listStations({ ...params, limit: params.limit ?? 50 }),
  });
}

export function useCreateKitchenStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKitchenStationInput) => api.admin.kitchen.createStation(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-kitchen-stations"] }),
  });
}

export function useUpdateKitchenStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateKitchenStationInput }) =>
      api.admin.kitchen.updateStation(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-kitchen-stations"] }),
  });
}

export function useRemoveKitchenStation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.kitchen.removeStation(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-kitchen-stations"] }),
  });
}
