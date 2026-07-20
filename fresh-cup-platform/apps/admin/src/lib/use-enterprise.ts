import type {
  CreateBranchGroupInput,
  CreateFranchiseInput,
  CreateRegionInput,
  CreateSsoConnectionInput,
  CreateTaxRuleInput,
  SetExchangeRateInput,
  SetFeatureFlagOverrideInput,
  UpdateOrganizationInput,
} from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api-client";

// --- Organization ---

export function useOrganization() {
  return useQuery({
    queryKey: ["enterprise-organization"],
    queryFn: () => api.admin.enterprise.getOrganization(),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) => api.admin.enterprise.updateOrganization(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-organization"] }),
  });
}

// --- Regions ---

export function useRegions() {
  return useQuery({
    queryKey: ["enterprise-regions"],
    queryFn: () => api.admin.enterprise.listRegions(),
  });
}

export function useCreateRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRegionInput) => api.admin.enterprise.createRegion(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-regions"] }),
  });
}

export function useDeleteRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.enterprise.deleteRegion(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-regions"] }),
  });
}

// --- Franchises ---

export function useFranchises() {
  return useQuery({
    queryKey: ["enterprise-franchises"],
    queryFn: () => api.admin.enterprise.listFranchises(),
  });
}

export function useCreateFranchise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFranchiseInput) => api.admin.enterprise.createFranchise(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-franchises"] }),
  });
}

// --- Branch groups ---

export function useBranchGroups() {
  return useQuery({
    queryKey: ["enterprise-branch-groups"],
    queryFn: () => api.admin.enterprise.listBranchGroups(),
  });
}

export function useCreateBranchGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBranchGroupInput) => api.admin.enterprise.createBranchGroup(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-branch-groups"] }),
  });
}

export function useDeleteBranchGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.enterprise.deleteBranchGroup(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-branch-groups"] }),
  });
}

// --- Feature flags ---

export function useFeatureFlagDefinitions() {
  return useQuery({
    queryKey: ["enterprise-feature-flag-definitions"],
    queryFn: () => api.admin.enterprise.listFeatureFlagDefinitions(),
  });
}

export function useFeatureFlagOverrides() {
  return useQuery({
    queryKey: ["enterprise-feature-flag-overrides"],
    queryFn: () => api.admin.enterprise.listFeatureFlagOverrides(),
  });
}

export function useSetFeatureFlagOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: SetFeatureFlagOverrideInput }) =>
      api.admin.enterprise.setFeatureFlagOverride(key, input),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["enterprise-feature-flag-overrides"] }),
  });
}

// --- Licensing ---

export function usePlans() {
  return useQuery({
    queryKey: ["enterprise-plans"],
    queryFn: () => api.admin.enterprise.listPlans(),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ["enterprise-subscription"],
    queryFn: () => api.admin.enterprise.getSubscription(),
  });
}

export function useSeatUsage() {
  return useQuery({
    queryKey: ["enterprise-seat-usage"],
    queryFn: () => api.admin.enterprise.getSeatUsage(),
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planKey, seats }: { planKey: string; seats?: number }) =>
      api.admin.enterprise.subscribe(planKey, seats),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["enterprise-subscription"] });
      void queryClient.invalidateQueries({ queryKey: ["enterprise-seat-usage"] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.admin.enterprise.cancelSubscription(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-subscription"] }),
  });
}

// --- SSO ---

export function useSsoConnections() {
  return useQuery({
    queryKey: ["enterprise-sso-connections"],
    queryFn: () => api.admin.enterprise.listSsoConnections(),
  });
}

export function useCreateSsoConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSsoConnectionInput) =>
      api.admin.enterprise.createSsoConnection(input),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["enterprise-sso-connections"] }),
  });
}

// --- Currency & tax ---

export function useCurrencies() {
  return useQuery({
    queryKey: ["enterprise-currencies"],
    queryFn: () => api.admin.enterprise.listCurrencies(),
  });
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ["enterprise-exchange-rates"],
    queryFn: () => api.admin.enterprise.listExchangeRates(),
  });
}

export function useSetExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetExchangeRateInput) => api.admin.enterprise.setExchangeRate(input),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["enterprise-exchange-rates"] }),
  });
}

export function useTaxRules() {
  return useQuery({
    queryKey: ["enterprise-tax-rules"],
    queryFn: () => api.admin.enterprise.listTaxRules(),
  });
}

export function useCreateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaxRuleInput) => api.admin.enterprise.createTaxRule(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-tax-rules"] }),
  });
}

export function useDeleteTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.enterprise.deleteTaxRule(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["enterprise-tax-rules"] }),
  });
}

// --- Analytics ---

export function useCorporateDashboard(from?: string, to?: string) {
  return useQuery({
    queryKey: ["enterprise-corporate-dashboard", from, to],
    queryFn: () => api.admin.enterprise.corporateDashboard(from, to),
  });
}

export function useCrossRegionAnalytics(from?: string, to?: string) {
  return useQuery({
    queryKey: ["enterprise-cross-region", from, to],
    queryFn: () => api.admin.enterprise.crossRegionAnalytics(from, to),
  });
}

export function useBranchBenchmark(from?: string, to?: string) {
  return useQuery({
    queryKey: ["enterprise-benchmark", from, to],
    queryFn: () => api.admin.enterprise.benchmarkBranches(from, to),
  });
}

export function useExecutiveScorecard(from?: string, to?: string) {
  return useQuery({
    queryKey: ["enterprise-scorecard", from, to],
    queryFn: () => api.admin.enterprise.executiveScorecard(from, to),
  });
}

export function useAggregatedForecast() {
  return useQuery({
    queryKey: ["enterprise-forecast"],
    queryFn: () => api.admin.enterprise.aggregateForecast(),
  });
}
