import type { RequestUser } from "../../../common/types/request-user.interface";
import type { CustomerIntelligenceService } from "../../../modules/intelligence/customer-intelligence/customer-intelligence.service";
import type { ExplanationService } from "../explanation.service";
import { CustomerAiService } from "./customer-ai.service";

const actor: RequestUser = { id: "user-1", role: "MANAGER" as never, branchId: null };

function profile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: "cust-1",
    fullName: "Abebe Kebede",
    recencyDays: 5,
    ordersCount: 8,
    totalSpend: 50000,
    avgOrderValue: 6250,
    purchaseFrequencyDays: 10,
    rfm: { recency: 4, frequency: 4, monetary: 4 },
    segment: "Champions",
    churnRisk: 0.1,
    predictedLtv: 200000,
    favoriteCategories: [{ categoryId: "c1", name: "Smoothies", orderCount: 5 }],
    preferredOrderHour: 12,
    preferredPaymentMethod: "CASH",
    couponEffectiveness: {
      ordersWithCoupon: 1,
      ordersWithoutCoupon: 7,
      avgOrderValueWithCoupon: 6000,
      avgOrderValueWithoutCoupon: 6300,
    },
    loyaltyProgression: {
      currentBalance: 100,
      lifetimeEarned: 500,
      tier: "Silver",
      pointsToNextTier: 1500,
    },
    ...overrides,
  };
}

describe("CustomerAiService", () => {
  function makeService() {
    const customerIntelligence = {
      customerProfile: jest.fn().mockResolvedValue(profile()),
      segments: jest.fn(),
      segmentSummary: jest.fn(),
    } as unknown as jest.Mocked<CustomerIntelligenceService>;
    const explanation = {
      explain: jest
        .fn()
        .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
    } as unknown as jest.Mocked<ExplanationService>;

    const service = new CustomerAiService(customerIntelligence, explanation);
    return { service, customerIntelligence };
  }

  it("computes predicted lifetime value from the customer profile", async () => {
    const { service } = makeService();
    const result = await service.lifetimeValue(actor, "cust-1");
    expect(result.title).toContain("Abebe Kebede");
    expect((result.data as { predictedLtv: number }).predictedLtv).toBe(200000);
  });

  it("filters churn prediction to At Risk / Lost segments, highest risk first", async () => {
    const { service, customerIntelligence } = makeService();
    customerIntelligence.segments.mockResolvedValue([
      { ...profile({ segment: "Champions", churnRisk: 0.05 }) } as never,
      { ...profile({ segment: "At Risk", churnRisk: 0.6, fullName: "Sara" }) } as never,
      { ...profile({ segment: "Lost", churnRisk: 0.9, fullName: "Mimi" }) } as never,
    ]);

    const results = await service.churnPrediction(actor);
    expect(results).toHaveLength(2);
    expect(results[0]!.title).toContain("Mimi");
    expect(results[1]!.title).toContain("Sara");
  });

  it("maps segment summary rows into behavior-cluster insights", async () => {
    const { service, customerIntelligence } = makeService();
    customerIntelligence.segmentSummary.mockResolvedValue([
      { segment: "Champions", customerCount: 10, totalSpend: 500000 },
    ]);

    const results = await service.behaviorClusters(actor);
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Segment: Champions");
  });

  it("returns favorite categories from the customer profile", async () => {
    const { service } = makeService();
    const result = await service.favoriteProducts(actor, "cust-1");
    expect(result.data).toEqual([{ categoryId: "c1", name: "Smoothies", orderCount: 5 }]);
  });

  it("returns purchase-pattern fields from the customer profile", async () => {
    const { service } = makeService();
    const result = await service.purchasePatterns(actor, "cust-1");
    expect(result.data).toEqual({
      preferredOrderHour: 12,
      preferredPaymentMethod: "CASH",
      purchaseFrequencyDays: 10,
    });
  });
});
