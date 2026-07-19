/**
 * Feature Store output shapes — one interface per entity type, reused by
 * every model in prediction/, forecasting/, and segmentation/ rather than
 * each computing its own inputs. Numeric-only (models score on numbers),
 * with a `raw` bag for the human-readable values explainability needs.
 */
export interface CustomerFeatureVector {
  userId: string;
  visitFrequencyPerMonth: number;
  avgOrderValueEtb: number;
  daysSinceLastVisit: number;
  favoriteCategoryCount: number;
  loyaltyLevel: number; // 0=none, 1=Bronze, 2=Silver, 3=Gold
  ordersCount: number;
  totalSpendEtb: number;
  churnRisk: number;
  raw: Record<string, unknown>;
}

export interface SalesFeatureVector {
  date: string;
  weekday: number; // 0=Sunday .. 6=Saturday
  month: number; // 1-12
  isHoliday: boolean;
  weatherPlaceholder: null; // no weather API integrated yet — always null
  activePromotionsCount: number;
  raw: Record<string, unknown>;
}

export interface InventoryFeatureVector {
  inventoryItemId: string;
  consumptionTrend: number; // slope of trailing daily consumption, unitless
  avgSupplierDelayDays: number;
  wastePercent: number;
  raw: Record<string, unknown>;
}

export interface KitchenFeatureVector {
  stationId: string;
  avgPrepTimeSeconds: number;
  stationLoad: number; // items prepared, trailing 30 days
  raw: Record<string, unknown>;
}

export interface DeliveryFeatureVector {
  zoneId: string;
  avgEtaMinutes: number;
  driverUtilization: number; // deliveries per active driver, trailing 30 days
  raw: Record<string, unknown>;
}

export interface MarketingFeatureVector {
  couponUsageRate: number; // 0-1, redemptions / max redemptions (or vs. a fleet baseline if uncapped)
  referralConversionRate: number; // 0-1
  campaignRoi: number; // revenueFromCouponOrders / couponDiscountGiven, 0 if no spend
  raw: Record<string, unknown>;
}
