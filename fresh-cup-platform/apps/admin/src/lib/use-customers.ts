import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PaginationParams } from "@fresh-cup/api-client";

export function useCustomers(params: PaginationParams) {
  return useQuery({
    queryKey: ["admin-customers", params],
    queryFn: () => api.admin.users.list({ ...params, role: "CUSTOMER", limit: params.limit ?? 50 }),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => api.admin.users.get(id),
    enabled: Boolean(id),
  });
}

export function useSetCustomerActive(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isActive: boolean) => api.admin.users.update(id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-customer", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
  });
}
