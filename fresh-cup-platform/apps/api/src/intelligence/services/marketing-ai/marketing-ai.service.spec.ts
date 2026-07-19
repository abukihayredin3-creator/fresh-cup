import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { MarketingIntelligenceService } from "../../../modules/intelligence/marketing-intelligence/marketing-intelligence.service";
import type { ExplanationService } from "../explanation.service";
import { MarketingAiService } from "./marketing-ai.service";

const actor: RequestUser = { id: "user-1", role: "MANAGER" as never, branchId: null };

describe("MarketingAiService", () => {
  function makeService(enabled = true) {
    const marketingIntelligence = {
      targetSuggestions: jest.fn().mockResolvedValue([]),
      couponOptimization: jest.fn().mockResolvedValue([]),
      campaignPerformance: jest.fn().mockResolvedValue([]),
      referralOptimization: jest
        .fn()
        .mockResolvedValue({
          totalCodesIssued: 0,
          totalRedemptions: 0,
          conversionRate: 0,
          avgRewardCostPerAcquisition: 0,
          topReferrers: [],
        }),
      loyaltyOptimization: jest
        .fn()
        .mockResolvedValue({
          activeMembers: 0,
          avgBalance: 0,
          membersNearNextTier: 0,
          totalUnredeemedPoints: 0,
        }),
    } as unknown as jest.Mocked<MarketingIntelligenceService>;
    const explanation = {
      explain: jest
        .fn()
        .mockImplementation((topic: string) => Promise.resolve(`Explained: ${topic}`)),
    } as unknown as jest.Mocked<ExplanationService>;
    const config = { get: () => enabled } as unknown as ConfigService<EnvironmentVariables, true>;

    const service = new MarketingAiService(config, marketingIntelligence, explanation);
    return { service, marketingIntelligence };
  }

  it("throws ForbiddenException when AI_MARKETING_ENABLED is false", async () => {
    const { service } = makeService(false);
    await expect(service.campaignRecommendations(actor)).rejects.toThrow(ForbiddenException);
  });

  it("maps target suggestions into campaign recommendations", async () => {
    const { service, marketingIntelligence } = makeService();
    marketingIntelligence.targetSuggestions.mockResolvedValue([
      {
        segment: "At Risk",
        customerCount: 5,
        suggestion: "win them back",
        recommendedChannel: "SMS",
      },
    ]);
    const results = await service.campaignRecommendations(actor);
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Campaign recommendation: At Risk");
  });

  it("maps coupons into insights", async () => {
    const { service, marketingIntelligence } = makeService();
    marketingIntelligence.couponOptimization.mockResolvedValue([
      {
        couponId: "c1",
        code: "SAVE10",
        redemptionCount: 20,
        maxRedemptions: 100,
        avgOrderValueWithCoupon: 5000,
        avgOrderValueBaseline: 6000,
        recommendation: "effective",
      },
    ]);
    const results = await service.couponOptimization();
    expect(results[0]!.title).toBe("Coupon: SAVE10");
  });

  it("filters campaign performance to campaigns with a computed lift", async () => {
    const { service, marketingIntelligence } = makeService();
    marketingIntelligence.campaignPerformance.mockResolvedValue([
      {
        campaignId: "c1",
        name: "Sent",
        channel: "EMAIL",
        recipientCount: 100,
        sentAt: "2026-01-01",
        estimatedOrderLiftPercent: 12,
      },
      {
        campaignId: "c2",
        name: "Unsent",
        channel: "SMS",
        recipientCount: null,
        sentAt: null,
        estimatedOrderLiftPercent: null,
      },
    ]);
    const results = await service.promotionRoiPrediction();
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Promotion ROI: Sent");
  });

  it("combines referral top-referrers and loyalty near-tier members into customer targeting insights", async () => {
    const { service, marketingIntelligence } = makeService();
    marketingIntelligence.referralOptimization.mockResolvedValue({
      totalCodesIssued: 10,
      totalRedemptions: 4,
      conversionRate: 0.4,
      avgRewardCostPerAcquisition: 500,
      topReferrers: [{ userId: "u1", fullName: "Sara", usesCount: 3 }],
    });
    marketingIntelligence.loyaltyOptimization.mockResolvedValue({
      activeMembers: 50,
      avgBalance: 120,
      membersNearNextTier: 8,
      totalUnredeemedPoints: 4000,
    });

    const results = await service.customerTargeting();
    expect(results.map((r) => r.title)).toEqual([
      "Referral network targeting",
      "Loyalty tier-upgrade targeting",
    ]);
  });

  it("omits customer-targeting insights with nothing to report", async () => {
    const { service } = makeService();
    const results = await service.customerTargeting();
    expect(results).toHaveLength(0);
  });
});
