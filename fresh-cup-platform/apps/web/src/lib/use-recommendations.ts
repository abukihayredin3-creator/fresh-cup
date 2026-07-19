import { useQuery } from "@tanstack/react-query";
import { api } from "./api-client";

export function useFrequentlyBoughtTogether(menuItemId: string | undefined) {
  return useQuery({
    queryKey: ["recommendations-fbt", menuItemId],
    queryFn: () => api.recommendations.frequentlyBoughtTogether(menuItemId as string, 6),
    enabled: Boolean(menuItemId),
  });
}

export function useSimilarProducts(menuItemId: string | undefined) {
  return useQuery({
    queryKey: ["recommendations-similar", menuItemId],
    queryFn: () => api.recommendations.similar(menuItemId as string, 6),
    enabled: Boolean(menuItemId),
  });
}

export function useCartRecommendations(menuItemIds: string[]) {
  const key = menuItemIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["recommendations-cart", key],
    queryFn: () => api.recommendations.forCart(menuItemIds, 6),
    enabled: menuItemIds.length > 0,
  });
}

export function useTrendingRecommendations(branchId: string | null) {
  return useQuery({
    queryKey: ["recommendations-trending", branchId],
    queryFn: () => api.recommendations.trending({ branchId: branchId ?? undefined, limit: 8 }),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });
}

export function usePersonalizedRecommendations(branchId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["recommendations-personalized", branchId],
    queryFn: () => api.recommendations.personalized({ branchId: branchId ?? undefined, limit: 8 }),
    enabled: enabled && Boolean(branchId),
    staleTime: 60_000,
  });
}
