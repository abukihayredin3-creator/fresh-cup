import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

const REFRESH_INTERVAL_MS = 30_000;

export function useDashboard(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-dashboard", branchId],
    queryFn: () => api.admin.analytics.dashboard(branchId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useSalesTrend(branchId: string | undefined) {
  const to = new Date();
  const from = new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);
  return useQuery({
    queryKey: ["admin-sales-trend", branchId],
    queryFn: () =>
      api.admin.analytics.sales({
        branchId,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      }),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}

export function useAdminBranches(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-branches"],
    queryFn: () => api.admin.branches.listAll(),
    enabled,
    staleTime: 60_000,
  });
}
