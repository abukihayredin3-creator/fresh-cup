// Phase 6 — AI & Business Intelligence. Mirrors apps/api's
// modules/intelligence DTOs; see docs/API_DESIGN.md for the endpoint catalog.

// --- Customer intelligence ---

export interface RfmScore {
  recency: number;
  frequency: number;
  monetary: number;
}

export interface CustomerSegment {
  userId: string;
  fullName: string;
  recencyDays: number;
  ordersCount: number;
  /** ETB minor units, lifetime. */
  totalSpend: number;
  rfm: RfmScore;
  segment: string;
  /** 0-1, higher means more likely to churn. */
  churnRisk: number;
  /** ETB minor units, predicted lifetime value. */
  predictedLtv: number;
}

export interface ListSegmentsParams {
  branchId?: string;
  segment?: string;
  limit?: number;
}

export interface SegmentSummaryEntry {
  segment: string;
  customerCount: number;
  /** ETB minor units, summed across the segment. */
  totalSpend: number;
}

export interface FavoriteCategory {
  categoryId: string;
  name: string;
  orderCount: number;
}

export interface CouponEffectiveness {
  ordersWithCoupon: number;
  ordersWithoutCoupon: number;
  /** ETB minor units. */
  avgOrderValueWithCoupon: number;
  /** ETB minor units. */
  avgOrderValueWithoutCoupon: number;
}

export interface LoyaltyProgression {
  currentBalance: number;
  lifetimeEarned: number;
  tier: string;
  pointsToNextTier: number | null;
}

export interface CustomerIntelligenceProfile {
  userId: string;
  fullName: string;
  recencyDays: number;
  ordersCount: number;
  /** ETB minor units. */
  totalSpend: number;
  /** ETB minor units. */
  avgOrderValue: number;
  purchaseFrequencyDays: number | null;
  rfm: RfmScore;
  segment: string;
  churnRisk: number;
  /** ETB minor units. */
  predictedLtv: number;
  favoriteCategories: FavoriteCategory[];
  preferredOrderHour: number | null;
  preferredPaymentMethod: string | null;
  couponEffectiveness: CouponEffectiveness;
  loyaltyProgression: LoyaltyProgression;
}

// --- Forecasting ---

export type ForecastMetric =
  "SALES_REVENUE" | "SALES_ORDERS" | "HOURLY_DEMAND" | "PRODUCT_DEMAND" | "INGREDIENT_DEMAND";

export type ForecastGranularity = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";

export interface ForecastQueryParams {
  metric?: ForecastMetric;
  granularity?: ForecastGranularity;
  branchId?: string;
}

export interface ForecastPoint {
  targetPeriodStart: string;
  predictedValue: number;
  actualValue: number | null;
  confidence: number;
}

export interface ForecastSeries {
  metric: string;
  granularity: string;
  modelVersion: number;
  points: ForecastPoint[];
}

export interface HourlyDemandPoint {
  hour: number;
  predictedOrders: number;
  seasonalIndex: number;
}

export interface ProductDemandForecast {
  menuItemId: string;
  nameEn: string;
  points: ForecastPoint[];
}

export interface MlModelRun {
  id: string;
  modelKey: string;
  version: number;
  status: "READY" | "FAILED";
  metrics: Record<string, unknown> | null;
  notes: string | null;
  trainedAt: string;
}

// --- Inventory intelligence ---

export interface InventoryIntelligenceItem {
  inventoryItemId: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  avgDailyConsumption: number;
  daysUntilStockout: number | null;
  wasteProbability: number;
  expiryRisk: number | null;
  suggestedReorderQuantity: number;
  /** ETB minor units. */
  suggestedReorderCost: number;
}

// --- Marketing intelligence ---

export interface CampaignPerformance {
  campaignId: string;
  name: string;
  channel: string;
  recipientCount: number | null;
  sentAt: string | null;
  estimatedOrderLiftPercent: number | null;
}

export interface CouponOptimization {
  couponId: string;
  code: string;
  redemptionCount: number;
  maxRedemptions: number | null;
  /** ETB minor units. */
  avgOrderValueWithCoupon: number;
  /** ETB minor units. */
  avgOrderValueBaseline: number;
  recommendation: string;
}

export interface ReferralOptimization {
  totalCodesIssued: number;
  totalRedemptions: number;
  conversionRate: number;
  /** ETB minor units. */
  avgRewardCostPerAcquisition: number;
  topReferrers: { userId: string; fullName: string; usesCount: number }[];
}

export interface LoyaltyOptimization {
  activeMembers: number;
  avgBalance: number;
  membersNearNextTier: number;
  totalUnredeemedPoints: number;
}

export interface TargetSuggestion {
  segment: string;
  customerCount: number;
  suggestion: string;
  recommendedChannel: string;
}

// --- Executive BI ---

export interface RevenueTrendPoint {
  date: string;
  /** ETB minor units. */
  revenue: number;
  /** ETB minor units. */
  estimatedProfit: number;
}

export interface ProductProfitability {
  menuItemId: string;
  nameEn: string;
  /** ETB minor units. */
  revenue: number;
  /** ETB minor units. */
  estimatedCogs: number;
  /** ETB minor units. */
  estimatedMargin: number;
}

export interface BranchComparison {
  branchId: string;
  name: string;
  /** ETB minor units. */
  revenue: number;
  orders: number;
  /** ETB minor units. */
  avgOrderValue: number;
}

export interface CustomerGrowthPoint {
  date: string;
  newCustomers: number;
}

export interface PeakHour {
  hour: number;
  orderCount: number;
}

export interface ConversionMetrics {
  cartsCreated: number;
  ordersPlaced: number;
  conversionRate: number;
}

export interface InventoryCosts {
  /** ETB minor units. */
  purchasingSpend: number;
  /** ETB minor units. */
  wasteCost: number;
}

export interface MarketingRoi {
  /** ETB minor units. */
  couponDiscountGiven: number;
  /** ETB minor units. */
  revenueFromCouponOrders: number;
  returnPerDiscountBirr: number | null;
}

export interface ExecutiveOverview {
  from: string;
  to: string;
  /** ETB minor units. */
  totalRevenue: number;
  /** ETB minor units. */
  totalEstimatedProfit: number;
  repeatCustomerRate: number;
  revenueTrend: RevenueTrendPoint[];
  productProfitability: ProductProfitability[];
  branchComparison: BranchComparison[];
  customerGrowth: CustomerGrowthPoint[];
  peakHours: PeakHour[];
  conversionMetrics: ConversionMetrics;
  inventoryCosts: InventoryCosts;
  marketingRoi: MarketingRoi;
}

export interface ForecastVsActualPoint {
  targetPeriodStart: string;
  predictedValue: number;
  actualValue: number | null;
}

export interface ForecastVsActual {
  modelVersion: number;
  points: ForecastVsActualPoint[];
}

// --- AI assistant ---

export interface AiAssistantToolCall {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface AiAssistantResponse {
  answer: string;
  outcome: "ANSWERED" | "FALLBACK" | "ERROR";
  toolCalls: AiAssistantToolCall[];
}
