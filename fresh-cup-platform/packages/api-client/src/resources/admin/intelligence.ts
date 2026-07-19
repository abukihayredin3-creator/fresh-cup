import type {
  AiAssistantResponse,
  BestSellerPrediction,
  CategoryTrendPrediction,
  ClusterAssignment,
  ClusteringStrategyName,
  CouponOptimization,
  CustomerIntelligenceProfile,
  CustomerPredictions,
  CustomerSegment,
  DriftAlert,
  ExecutiveOverview,
  ForecastQueryParams,
  ForecastSeries,
  ForecastVsActual,
  HourlyDemandPoint,
  InventoryIntelligenceItem,
  ListSegmentsParams,
  LoyaltyOptimization,
  MlModelRun,
  PredictionResult,
  PredictiveModelRun,
  PredictiveModelStage,
  PredictiveSegmentSummaryEntry,
  ProductDemandForecast,
  CampaignPerformance,
  ReferralOptimization,
  SegmentSummaryEntry,
  TargetSuggestion,
  TriggerCheckResult,
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

  // --- Phase 11 Part 2 — Predictive Intelligence Platform ---

  // Predictions
  customerPredictions(userId: string): Promise<CustomerPredictions> {
    return this.client.request(`/admin/ai/predictions/customer/${userId}`);
  }

  // Forecast facade
  aiHourlySalesForecast(branchId?: string): Promise<PredictionResult> {
    return this.client.request(`/admin/ai/forecast/hourly-sales${toQueryString({ branchId })}`);
  }

  aiDailySalesForecast(branchId?: string): Promise<PredictionResult> {
    return this.client.request(`/admin/ai/forecast/daily-sales${toQueryString({ branchId })}`);
  }

  aiWeeklySalesForecast(branchId?: string): Promise<PredictionResult> {
    return this.client.request(`/admin/ai/forecast/weekly-sales${toQueryString({ branchId })}`);
  }

  aiMonthlySalesForecast(branchId?: string): Promise<PredictionResult> {
    return this.client.request(`/admin/ai/forecast/monthly-sales${toQueryString({ branchId })}`);
  }

  aiRevenueForecast(branchId?: string): Promise<PredictionResult> {
    return this.client.request(`/admin/ai/forecast/revenue${toQueryString({ branchId })}`);
  }

  aiTransactionsForecast(branchId?: string): Promise<PredictionResult> {
    return this.client.request(`/admin/ai/forecast/transactions${toQueryString({ branchId })}`);
  }

  aiAverageTicketForecast(branchId?: string): Promise<PredictionResult> {
    return this.client.request(`/admin/ai/forecast/average-ticket${toQueryString({ branchId })}`);
  }

  aiBestSellersForecast(branchId?: string): Promise<BestSellerPrediction> {
    return this.client.request(`/admin/ai/forecast/best-sellers${toQueryString({ branchId })}`);
  }

  aiCategoryTrendsForecast(branchId?: string): Promise<CategoryTrendPrediction> {
    return this.client.request(`/admin/ai/forecast/category-trends${toQueryString({ branchId })}`);
  }

  // Model registry
  modelRegistryRuns(modelKey?: string): Promise<PredictiveModelRun[]> {
    return this.client.request(`/admin/ai/models${toQueryString({ modelKey })}`);
  }

  modelRegistryRunsByStage(stage: PredictiveModelStage): Promise<PredictiveModelRun[]> {
    return this.client.request(`/admin/ai/models/stage/${stage}`);
  }

  promoteModel(
    modelKey: string,
    version: number,
    stage: PredictiveModelStage,
  ): Promise<PredictiveModelRun> {
    return this.client.request(`/admin/ai/models/${modelKey}/${version}/promote`, {
      method: "POST",
      body: JSON.stringify({ stage }),
    });
  }

  // Retraining
  checkRetrainTriggers(modelKey: string): Promise<TriggerCheckResult> {
    return this.client.request(`/admin/ai/retrain/check/${modelKey}`);
  }

  retrainModel(modelKey: string): Promise<PredictiveModelRun> {
    return this.client.request(`/admin/ai/retrain/${modelKey}`, { method: "POST" });
  }

  retrainAllDue(): Promise<TriggerCheckResult[]> {
    return this.client.request("/admin/ai/retrain", { method: "POST" });
  }

  // Drift
  driftAlerts(modelKey?: string, unresolvedOnly?: boolean): Promise<DriftAlert[]> {
    return this.client.request(
      `/admin/ai/drift${toQueryString({ modelKey, unresolvedOnly: unresolvedOnly ? "true" : undefined })}`,
    );
  }

  resolveDriftAlert(id: string): Promise<DriftAlert> {
    return this.client.request(`/admin/ai/drift/${id}/resolve`, { method: "POST" });
  }

  // Segmentation (Part 2 configurable clustering — distinct from Phase 6's customerSegments)
  predictiveSegmentation(
    branchId?: string,
    strategy?: ClusteringStrategyName,
  ): Promise<ClusterAssignment[]> {
    return this.client.request(`/admin/ai/segmentation${toQueryString({ branchId, strategy })}`);
  }

  predictiveSegmentationSummary(
    branchId?: string,
    strategy?: ClusteringStrategyName,
  ): Promise<PredictiveSegmentSummaryEntry[]> {
    return this.client.request(
      `/admin/ai/segmentation/summary${toQueryString({ branchId, strategy })}`,
    );
  }
}
