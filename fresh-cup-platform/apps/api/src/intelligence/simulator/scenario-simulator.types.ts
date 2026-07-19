export type ScenarioType = "price_change" | "promotion" | "staffing_change";

export interface ScenarioInput {
  type: ScenarioType;
  /** price_change: % price delta. promotion: % discount offered. staffing_change: % staffed-hours delta. */
  magnitudePercent: number;
  branchId?: string;
}

export interface ScenarioProjection {
  metric: "revenue" | "customers" | "profit" | "inventoryDemand";
  baseline: number;
  projected: number;
  changePercent: number;
}

export interface ScenarioResult {
  scenario: ScenarioInput;
  assumptions: string[];
  projections: ScenarioProjection[];
  confidence: number;
  generatedAt: string;
}
