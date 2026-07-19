import type {
  DateRangeParams,
  ForecastGranularity,
  ForecastMetric,
  ListSegmentsParams,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

// --- Executive BI ---

export function useExecutiveOverview(params: DateRangeParams) {
  return useQuery({
    queryKey: ["admin-executive-overview", params],
    queryFn: () => api.admin.intelligence.executiveOverview(params),
  });
}

export function useForecastVsActual(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-forecast-vs-actual", branchId],
    queryFn: () => api.admin.intelligence.forecastVsActual(branchId),
  });
}

// --- Forecasting ---

export function useSalesForecast(params: {
  metric?: ForecastMetric;
  granularity?: ForecastGranularity;
  branchId?: string;
}) {
  return useQuery({
    queryKey: ["admin-sales-forecast", params],
    queryFn: () => api.admin.intelligence.salesForecast(params),
  });
}

export function useHourlyDemandForecast(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-hourly-demand-forecast", branchId],
    queryFn: () => api.admin.intelligence.hourlyDemandForecast(branchId),
  });
}

export function useProductDemandForecast(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-product-demand-forecast", branchId],
    queryFn: () => api.admin.intelligence.productDemandForecast(branchId),
  });
}

export function useModelRuns(modelKey?: string) {
  return useQuery({
    queryKey: ["admin-model-runs", modelKey],
    queryFn: () => api.admin.intelligence.modelRuns(modelKey),
  });
}

export function useRegenerateForecasts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.admin.intelligence.regenerateForecasts(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-sales-forecast"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-hourly-demand-forecast"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-product-demand-forecast"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-model-runs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-forecast-vs-actual"] });
    },
  });
}

// --- Customer intelligence ---

export function useCustomerSegments(params: ListSegmentsParams) {
  return useQuery({
    queryKey: ["admin-customer-segments", params],
    queryFn: () => api.admin.intelligence.customerSegments(params),
  });
}

export function useSegmentSummary(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-segment-summary", branchId],
    queryFn: () => api.admin.intelligence.segmentSummary(branchId),
  });
}

export function useCustomerIntelligenceProfile(userId: string | null) {
  return useQuery({
    queryKey: ["admin-customer-intelligence-profile", userId],
    queryFn: () => api.admin.intelligence.customerProfile(userId as string),
    enabled: Boolean(userId),
  });
}

// --- Inventory intelligence ---

export function useInventoryIntelligence(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-inventory-intelligence", branchId],
    queryFn: () => api.admin.intelligence.inventoryIntelligence(branchId),
  });
}

// --- Marketing intelligence ---

export function useCampaignPerformance() {
  return useQuery({
    queryKey: ["admin-campaign-performance"],
    queryFn: () => api.admin.intelligence.campaignPerformance(),
  });
}

export function useCouponOptimization() {
  return useQuery({
    queryKey: ["admin-coupon-optimization"],
    queryFn: () => api.admin.intelligence.couponOptimization(),
  });
}

export function useReferralOptimization() {
  return useQuery({
    queryKey: ["admin-referral-optimization"],
    queryFn: () => api.admin.intelligence.referralOptimization(),
  });
}

export function useLoyaltyOptimization() {
  return useQuery({
    queryKey: ["admin-loyalty-optimization"],
    queryFn: () => api.admin.intelligence.loyaltyOptimization(),
  });
}

export function useTargetSuggestions() {
  return useQuery({
    queryKey: ["admin-target-suggestions"],
    queryFn: () => api.admin.intelligence.targetSuggestions(),
  });
}

// --- Recommendations (public endpoints, browsed here for a merchandising report) ---

export function useTrendingRecommendations(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-trending-recommendations", branchId],
    queryFn: () => api.recommendations.trending({ branchId, limit: 10 }),
  });
}

export function useSeasonalRecommendations(branchId: string | undefined) {
  return useQuery({
    queryKey: ["admin-seasonal-recommendations", branchId],
    queryFn: () => api.recommendations.seasonal({ branchId, limit: 10 }),
  });
}

// --- AI assistant ---

export function useAskAssistant() {
  return useMutation({
    mutationFn: ({ question, branchId }: { question: string; branchId?: string }) =>
      api.admin.intelligence.askAssistant(question, branchId),
  });
}
