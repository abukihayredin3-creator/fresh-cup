import type {
  AggregatedForecast,
  BranchBenchmark,
  BranchGroup,
  Currency,
  CreateBranchGroupInput,
  CreateFranchiseInput,
  CreateRegionInput,
  CreateSsoConnectionInput,
  CreateTaxRuleInput,
  ExchangeRate,
  ExecutiveScorecard,
  ExportedFile,
  FeatureFlagDefinition,
  FeatureFlagOverride,
  Franchise,
  LocalizationContext,
  Organization,
  OrganizationSubscription,
  Region,
  RegionRollup,
  RollupResult,
  SeatLimitCheck,
  SetExchangeRateInput,
  SetFeatureFlagOverrideInput,
  SsoConnection,
  SubscriptionPlan,
  TaxRule,
  UpdateOrganizationInput,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString } from "../../query";

/**
 * Phase 8 — Enterprise & Global Restaurant Platform. Every method here
 * hits `enterprise/*` backend routes (not `admin/*` like the rest of
 * this file's siblings) since apps/api/src/enterprise/ is its own
 * tenant-scoped controller tree. Most calls need no organizationId
 * parameter — `TenantContextGuard` resolves it server-side from the
 * caller's branch/membership, same as every enterprise controller.
 */
export class AdminEnterpriseResource {
  constructor(private readonly client: ApiClient) {}

  // --- Organization ---
  getOrganization(): Promise<Organization> {
    return this.client.request("/enterprise/organizations/me");
  }

  updateOrganization(input: UpdateOrganizationInput): Promise<Organization> {
    return this.client.request("/enterprise/organizations/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  // --- Regions ---
  listRegions(): Promise<Region[]> {
    return this.client.request("/enterprise/regions");
  }

  createRegion(input: CreateRegionInput): Promise<Region> {
    return this.client.request("/enterprise/regions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteRegion(id: string): Promise<void> {
    return this.client.request(`/enterprise/regions/${id}`, { method: "DELETE" });
  }

  // --- Franchises ---
  listFranchises(): Promise<Franchise[]> {
    return this.client.request("/enterprise/franchises");
  }

  createFranchise(input: CreateFranchiseInput): Promise<Franchise> {
    return this.client.request("/enterprise/franchises", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  assignBranchToFranchise(franchiseId: string, branchId: string): Promise<void> {
    return this.client.request(`/enterprise/franchises/${franchiseId}/branches/${branchId}`, {
      method: "POST",
    });
  }

  // --- Branch groups ---
  listBranchGroups(): Promise<BranchGroup[]> {
    return this.client.request("/enterprise/branch-groups");
  }

  createBranchGroup(input: CreateBranchGroupInput): Promise<BranchGroup> {
    return this.client.request("/enterprise/branch-groups", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteBranchGroup(id: string): Promise<void> {
    return this.client.request(`/enterprise/branch-groups/${id}`, { method: "DELETE" });
  }

  addBranchToGroup(groupId: string, branchId: string): Promise<void> {
    return this.client.request(`/enterprise/branch-groups/${groupId}/branches/${branchId}`, {
      method: "POST",
    });
  }

  // --- Feature flags ---
  listFeatureFlagDefinitions(): Promise<FeatureFlagDefinition[]> {
    return this.client.request("/enterprise/feature-flags/definitions");
  }

  listFeatureFlagOverrides(): Promise<FeatureFlagOverride[]> {
    return this.client.request("/enterprise/feature-flags/overrides");
  }

  setFeatureFlagOverride(
    key: string,
    input: SetFeatureFlagOverrideInput,
  ): Promise<FeatureFlagOverride> {
    return this.client.request(`/enterprise/feature-flags/overrides/${key}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // --- Licensing ---
  listPlans(): Promise<SubscriptionPlan[]> {
    return this.client.request("/enterprise/licensing/plans");
  }

  getSubscription(): Promise<OrganizationSubscription | null> {
    return this.client.request("/enterprise/licensing/subscription");
  }

  subscribe(planKey: string, seats?: number): Promise<OrganizationSubscription> {
    return this.client.request("/enterprise/licensing/subscription", {
      method: "POST",
      body: JSON.stringify({ planKey, seats }),
    });
  }

  cancelSubscription(): Promise<OrganizationSubscription> {
    return this.client.request("/enterprise/licensing/subscription/cancel", { method: "POST" });
  }

  getSeatUsage(): Promise<SeatLimitCheck> {
    return this.client.request("/enterprise/licensing/seats");
  }

  // --- SSO ---
  listSsoConnections(): Promise<SsoConnection[]> {
    return this.client.request("/enterprise/sso/connections");
  }

  createSsoConnection(input: CreateSsoConnectionInput): Promise<SsoConnection> {
    return this.client.request("/enterprise/sso/connections", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // --- Currency & tax (Part 3) ---
  listCurrencies(): Promise<Currency[]> {
    return this.client.request("/enterprise/currency/currencies");
  }

  listExchangeRates(): Promise<ExchangeRate[]> {
    return this.client.request("/enterprise/currency/exchange-rates");
  }

  setExchangeRate(input: SetExchangeRateInput): Promise<ExchangeRate> {
    return this.client.request("/enterprise/currency/exchange-rates", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listTaxRules(): Promise<TaxRule[]> {
    return this.client.request("/enterprise/tax/rules");
  }

  createTaxRule(input: CreateTaxRuleInput): Promise<TaxRule> {
    return this.client.request("/enterprise/tax/rules", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteTaxRule(id: string): Promise<void> {
    return this.client.request(`/enterprise/tax/rules/${id}`, { method: "DELETE" });
  }

  getLocalizationContext(): Promise<LocalizationContext> {
    return this.client.request("/enterprise/localization/context");
  }

  // --- Analytics (Part 4) ---
  corporateDashboard(from?: string, to?: string): Promise<RollupResult> {
    return this.client.request(
      `/enterprise/analytics/corporate-dashboard${toQueryString({ from, to })}`,
    );
  }

  crossRegionAnalytics(from?: string, to?: string): Promise<RegionRollup[]> {
    return this.client.request(`/enterprise/analytics/cross-region${toQueryString({ from, to })}`);
  }

  benchmarkBranches(from?: string, to?: string): Promise<BranchBenchmark[]> {
    return this.client.request(`/enterprise/analytics/benchmark${toQueryString({ from, to })}`);
  }

  executiveScorecard(from?: string, to?: string): Promise<ExecutiveScorecard> {
    return this.client.request(`/enterprise/analytics/scorecard${toQueryString({ from, to })}`);
  }

  aggregateForecast(): Promise<AggregatedForecast> {
    return this.client.request("/enterprise/analytics/forecast");
  }

  exportCorporateDashboardCsv(from?: string, to?: string): Promise<ExportedFile> {
    return this.client.request(
      `/enterprise/analytics/exports/corporate-dashboard${toQueryString({ from, to })}`,
    );
  }

  exportBenchmarkCsv(from?: string, to?: string): Promise<ExportedFile> {
    return this.client.request(
      `/enterprise/analytics/exports/benchmark${toQueryString({ from, to })}`,
    );
  }

  exportScorecardCsv(from?: string, to?: string): Promise<ExportedFile> {
    return this.client.request(
      `/enterprise/analytics/exports/scorecard${toQueryString({ from, to })}`,
    );
  }
}
