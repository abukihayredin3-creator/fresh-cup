import type {
  AiAssistantResponse,
  CouponOptimization,
  CustomerIntelligenceProfile,
  CustomerSegment,
  ExecutiveOverview,
  ForecastQueryParams,
  ForecastSeries,
  ForecastVsActual,
  HourlyDemandPoint,
  InventoryIntelligenceItem,
  ListSegmentsParams,
  LoyaltyOptimization,
  MlModelRun,
  ProductDemandForecast,
  CampaignPerformance,
  ReferralOptimization,
  SegmentSummaryEntry,
  TargetSuggestion,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString } from "../../query";

/** Phase 6 — AI & Business Intelligence admin resources. */
export class AdminIntelligenceResource {
  constructor(private readonly client: ApiClient) {}

  // Customer intelligence
  customerSegments(params: ListSegmentsParams = {}): Promise<{ customers: CustomerSegment[] }> {
    return this.client.request(`/admin/customer-intelligence/segments${toQueryString(params)}`);
  }

  segmentSummary(branchId?: string): Promise<{ segments: SegmentSummaryEntry[] }> {
    return this.client.request(
      `/admin/customer-intelligence/segment-summary${toQueryString({ branchId })}`,
    );
  }

  customerProfile(id: string): Promise<CustomerIntelligenceProfile> {
    return this.client.request(`/admin/customer-intelligence/customers/${id}`);
  }

  // Forecasting
  salesForecast(params: ForecastQueryParams = {}): Promise<ForecastSeries> {
    return this.client.request(`/admin/forecasting/sales${toQueryString(params)}`);
  }

  hourlyDemandForecast(branchId?: string): Promise<HourlyDemandPoint[]> {
    return this.client.request(`/admin/forecasting/hourly-demand${toQueryString({ branchId })}`);
  }

  productDemandForecast(branchId?: string): Promise<ProductDemandForecast[]> {
    return this.client.request(`/admin/forecasting/product-demand${toQueryString({ branchId })}`);
  }

  modelRuns(modelKey?: string): Promise<MlModelRun[]> {
    return this.client.request(`/admin/forecasting/model-runs${toQueryString({ modelKey })}`);
  }

  regenerateForecasts(): Promise<{ triggered: true }> {
    return this.client.request("/admin/forecasting/regenerate", { method: "POST" });
  }

  // Inventory intelligence
  inventoryIntelligence(branchId?: string): Promise<{ items: InventoryIntelligenceItem[] }> {
    return this.client.request(`/admin/inventory-intelligence${toQueryString({ branchId })}`);
  }

  // Marketing intelligence
  campaignPerformance(limit?: number): Promise<CampaignPerformance[]> {
    return this.client.request(
      `/admin/marketing-intelligence/campaign-performance${toQueryString({ limit })}`,
    );
  }

  couponOptimization(): Promise<CouponOptimization[]> {
    return this.client.request("/admin/marketing-intelligence/coupon-optimization");
  }

  referralOptimization(): Promise<ReferralOptimization> {
    return this.client.request("/admin/marketing-intelligence/referral-optimization");
  }

  loyaltyOptimization(): Promise<LoyaltyOptimization> {
    return this.client.request("/admin/marketing-intelligence/loyalty-optimization");
  }

  targetSuggestions(): Promise<TargetSuggestion[]> {
    return this.client.request("/admin/marketing-intelligence/target-suggestions");
  }

  // Executive BI
  executiveOverview(
    params: { branchId?: string; from?: string; to?: string } = {},
  ): Promise<ExecutiveOverview> {
    return this.client.request(`/admin/executive/overview${toQueryString(params)}`);
  }

  forecastVsActual(branchId?: string): Promise<ForecastVsActual> {
    return this.client.request(`/admin/executive/forecast-vs-actual${toQueryString({ branchId })}`);
  }

  // AI assistant
  askAssistant(question: string, branchId?: string): Promise<AiAssistantResponse> {
    return this.client.request("/admin/ai-assistant/ask", {
      method: "POST",
      body: JSON.stringify({ question, branchId }),
    });
  }
}
