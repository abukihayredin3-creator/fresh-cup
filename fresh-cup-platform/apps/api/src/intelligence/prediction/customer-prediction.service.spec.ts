import type { RequestUser } from "../../common/types/request-user.interface";
import type { CustomerIntelligenceService } from "../../modules/intelligence/customer-intelligence/customer-intelligence.service";
import { ConfidenceCalibratorService } from "../calibration/confidence-calibrator.service";
import type { FeatureStoreService } from "../features/feature-store.service";
import type { ModelRegistryV2Service } from "../registry/model-registry-v2.service";
import { CustomerPredictionService } from "./customer-prediction.service";

const actor: RequestUser = { id: "user-1", role: "MANAGER" as never, branchId: null };

function customerFeatures(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: "cust-1",
    visitFrequencyPerMonth: 3,
    avgOrderValueEtb: 60,
    daysSinceLastVisit: 5,
    favoriteCategoryCount: 2,
    loyaltyLevel: 2,
    ordersCount: 8,
    totalSpendEtb: 480,
    churnRisk: 0.1,
    raw: {},
    ...overrides,
  };
}

function customerProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: "cust-1",
    fullName: "Abebe",
    recencyDays: 5,
    ordersCount: 8,
    totalSpend: 48000,
    avgOrderValue: 6000,
    purchaseFrequencyDays: 10,
    churnRisk: 0.1,
    predictedLtv: 200000,
    ...overrides,
  };
}

describe("CustomerPredictionService", () => {
  function makeService() {
    const featureStore = {
      customerFeatures: jest.fn().mockResolvedValue(customerFeatures()),
    } as unknown as jest.Mocked<FeatureStoreService>;
    const customerIntelligence = {
      customerProfile: jest.fn().mockResolvedValue(customerProfile()),
    } as unknown as jest.Mocked<CustomerIntelligenceService>;
    const registry = {
      latestRun: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<ModelRegistryV2Service>;
    const calibrator = new ConfidenceCalibratorService();

    const service = new CustomerPredictionService(
      featureStore,
      customerIntelligence,
      calibrator,
      registry,
    );
    return { service, featureStore, customerIntelligence, registry };
  }

  it("computes lifetime value from the real Phase 6 formula, with explainable contributing factors", async () => {
    const { service } = makeService();
    const result = await service.lifetimeValue(actor, "cust-1");

    expect(result.modelKey).toBe("customer-lifetime-value");
    expect(result.prediction).toBe(2000); // 200000 minor units -> 2000 ETB
    expect(result.contributingFactors.length).toBeGreaterThan(0);
    expect(result.topReasons.length).toBeGreaterThan(0);
    expect(result.suggestedAction).toBeTruthy();
  });

  it("falls back to model version 1 when the registry has no run yet", async () => {
    const { service } = makeService();
    const result = await service.churnPrediction(actor, "cust-1");
    expect(result.modelVersion).toBe(1);
  });

  it("uses the registry's latest version when one exists", async () => {
    const { service, registry } = makeService();
    (registry.latestRun as jest.Mock).mockResolvedValue({ version: 7 });
    const result = await service.repeatPurchaseProbability(actor, "cust-1");
    expect(result.modelVersion).toBe(7);
  });

  it.each([
    ["repeatPurchaseProbability", "repeat-purchase-probability"],
    ["churnPrediction", "customer-churn"],
    ["upsellPrediction", "customer-upsell"],
    ["crossSellPrediction", "customer-cross-sell"],
    ["couponResponsePrediction", "customer-coupon-response"],
    ["referralProbability", "customer-referral-probability"],
    ["satisfactionPrediction", "customer-satisfaction"],
  ] as const)("%s returns a full PredictionResultDto for modelKey %s", async (method, modelKey) => {
    const { service } = makeService();
    const result = await service[method](actor, "cust-1");

    expect(result.modelKey).toBe(modelKey);
    expect(result.prediction).toBeGreaterThanOrEqual(0);
    expect(result.prediction).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0.05);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
    expect(result.topReasons.length).toBeGreaterThan(0);
    expect(result.contributingFactors.length).toBeGreaterThan(0);
    expect(result.suggestedAction).toBeTruthy();
  });

  it("gives a frequent, engaged, low-churn-risk customer a high churn-prediction score close to 0", async () => {
    const { service, featureStore } = makeService();
    (featureStore.customerFeatures as jest.Mock).mockResolvedValue(
      customerFeatures({ visitFrequencyPerMonth: 10, daysSinceLastVisit: 1, ordersCount: 20 }),
    );
    const result = await service.churnPrediction(actor, "cust-1");
    expect(result.prediction).toBeLessThan(0.3);
  });

  it("gives a long-absent, infrequent customer a high churn-prediction score", async () => {
    const { service, featureStore } = makeService();
    (featureStore.customerFeatures as jest.Mock).mockResolvedValue(
      customerFeatures({ visitFrequencyPerMonth: 0.1, daysSinceLastVisit: 200, ordersCount: 1 }),
    );
    const result = await service.churnPrediction(actor, "cust-1");
    expect(result.prediction).toBeGreaterThan(0.7);
  });

  it("allPredictions() runs every model for one customer", async () => {
    const { service } = makeService();
    const results = await service.allPredictions(actor, "cust-1");
    expect(Object.keys(results)).toEqual([
      "clv",
      "repeatPurchase",
      "churn",
      "upsell",
      "crossSell",
      "couponResponse",
      "referral",
      "satisfaction",
    ]);
  });
});
