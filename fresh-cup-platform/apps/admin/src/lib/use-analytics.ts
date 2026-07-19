import type { DateRangeParams, TopListParams } from "@fresh-cup/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export function useSalesAnalytics(params: DateRangeParams) {
  return useQuery({
    queryKey: ["admin-analytics-sales", params],
    queryFn: () => api.admin.analytics.sales(params),
  });
}

export function useItemAnalytics(params: TopListParams) {
  return useQuery({
    queryKey: ["admin-analytics-items", params],
    queryFn: () => api.admin.analytics.items(params),
  });
}

export function useCustomerAnalytics(params: TopListParams) {
  return useQuery({
    queryKey: ["admin-analytics-customers", params],
    queryFn: () => api.admin.analytics.customers(params),
  });
}

export function useCustomerDetail(userId: string | null) {
  return useQuery({
    queryKey: ["admin-customer-detail", userId],
    queryFn: () => api.admin.analytics.customerDetail(userId as string),
    enabled: Boolean(userId),
  });
}

export function useKitchenAnalytics(params: DateRangeParams) {
  return useQuery({
    queryKey: ["admin-analytics-kitchen", params],
    queryFn: () => api.admin.analytics.kitchen(params),
  });
}

export function useDeliveryAnalytics(params: DateRangeParams) {
  return useQuery({
    queryKey: ["admin-analytics-delivery", params],
    queryFn: () => api.admin.analytics.delivery(params),
  });
}
