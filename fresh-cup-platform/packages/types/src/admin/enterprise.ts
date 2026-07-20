/** Phase 8 — Enterprise & Global Restaurant Platform admin types, mirroring apps/api/src/enterprise/. */

export type OrganizationStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
export type EnterpriseLocale = "EN" | "AM";
export type OrgRole = "ORG_OWNER" | "ORG_ADMIN" | "FRANCHISE_ADMIN" | "REGION_MANAGER";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
export type SsoProviderType = "GOOGLE_WORKSPACE" | "MICROSOFT_ENTRA_ID" | "OKTA" | "SAML";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  status: OrganizationStatus;
  timezone: string;
  defaultLocale: EnterpriseLocale;
  defaultCurrencyCode: string;
  onboardingCompletedAt?: string | null;
  branchCount: number;
}

export interface UpdateOrganizationInput {
  name?: string;
  domain?: string;
  timezone?: string;
  defaultLocale?: EnterpriseLocale;
  defaultCurrencyCode?: string;
}

export interface Region {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  countryCode: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegionInput {
  name: string;
  code: string;
  countryCode: string;
  timezone: string;
}

export interface Franchise {
  id: string;
  organizationId: string;
  name: string;
  ownerUserId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFranchiseInput {
  name: string;
  ownerUserId?: string;
}

export interface BranchGroup {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchGroupInput {
  name: string;
  description?: string;
}

export interface FeatureFlagDefinition {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  defaultEnabled: boolean;
  createdAt: string;
}

export interface FeatureFlagOverride {
  id: string;
  organizationId: string;
  featureFlagId: string;
  branchId?: string | null;
  enabled: boolean;
  rolloutPercentage?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetFeatureFlagOverrideInput {
  enabled: boolean;
  branchId?: string;
  rolloutPercentage?: number;
}

export interface SubscriptionPlan {
  id: string;
  key: string;
  name: string;
  maxBranches?: number | null;
  maxUsers?: number | null;
  priceMonthlyMinor?: number | null;
  features: string[];
  createdAt: string;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  seats: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  cancelledAt?: string | null;
}

export interface SeatLimitCheck {
  used: number;
  seats: number;
  withinLimit: boolean;
}

export interface SsoConnection {
  id: string;
  organizationId: string;
  provider: SsoProviderType;
  name: string;
  domainHint?: string | null;
  config: Record<string, unknown>;
  clientSecretEnvVar?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSsoConnectionInput {
  provider: SsoProviderType;
  name: string;
  domainHint?: string;
  config: Record<string, unknown>;
  clientSecretEnvVar?: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalDigits: number;
}

export interface ExchangeRate {
  id: string;
  organizationId: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rate: string;
  asOf: string;
}

export interface SetExchangeRateInput {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rate: number;
}

export interface TaxRule {
  id: string;
  organizationId: string;
  countryCode: string;
  regionId?: string | null;
  menuCategoryId?: string | null;
  name: string;
  ratePercent: string;
  isInclusive: boolean;
  createdAt: string;
}

export interface CreateTaxRuleInput {
  countryCode: string;
  regionId?: string;
  menuCategoryId?: string;
  name: string;
  ratePercent: number;
  isInclusive?: boolean;
}

export interface LocalizationContext {
  locale: EnterpriseLocale;
  timezone: string;
  currencyCode: string;
  countryCode?: string | null;
}

export interface BranchRevenueMetric {
  id: string;
  name: string;
  revenueMinor: number;
  orderCount: number;
  averageOrderValueMinor: number;
}

export interface RollupResult {
  branchCount: number;
  totalRevenueMinor: number;
  totalOrders: number;
  averageOrderValueMinor: number;
  byBranch: BranchRevenueMetric[];
}

export interface RegionRollup extends RollupResult {
  regionId: string | null;
  regionName: string;
}

export interface BranchBenchmark extends BranchRevenueMetric {
  rank: number;
  percentVsAverage: number;
}

export interface ExecutiveScorecard {
  branchCount: number;
  totalRevenueMinor: number;
  totalOrders: number;
  averageOrderValueMinor: number;
  previousPeriodRevenueMinor: number;
  revenueGrowthPercent: number;
  topBranch: BranchRevenueMetric | null;
  bottomBranch: BranchRevenueMetric | null;
}

export interface AggregatedForecast {
  branchCount: number;
  totalPredictedRevenueMinor: number;
  averageConfidence: number;
  byBranch: {
    branchId: string;
    branchName: string;
    predictedRevenueMinor: number;
    confidence: number;
  }[];
}

export interface EnterpriseDateRange {
  from?: string;
  to?: string;
}
