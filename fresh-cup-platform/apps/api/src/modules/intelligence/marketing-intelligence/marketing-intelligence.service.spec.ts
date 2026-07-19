import { UserRole } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import type { PrismaService } from "../../../database/prisma.service";
import type { CustomerIntelligenceService } from "../customer-intelligence/customer-intelligence.service";
import { MarketingIntelligenceService } from "./marketing-intelligence.service";

const admin: RequestUser = { id: "admin-1", role: UserRole.ADMIN, branchId: null };

describe("MarketingIntelligenceService", () => {
  let service: MarketingIntelligenceService;
  let prisma: {
    coupon: { findMany: jest.Mock };
    couponRedemption: { count: jest.Mock };
    order: { aggregate: jest.Mock };
    referralCode: { count: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
    referralRedemption: { count: jest.Mock };
    loyaltyLedger: { groupBy: jest.Mock; findFirst: jest.Mock };
  };
  let customerIntelligence: { segmentSummary: jest.Mock };

  beforeEach(() => {
    prisma = {
      coupon: { findMany: jest.fn() },
      couponRedemption: { count: jest.fn() },
      order: { aggregate: jest.fn() },
      referralCode: { count: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
      referralRedemption: { count: jest.fn() },
      loyaltyLedger: { groupBy: jest.fn(), findFirst: jest.fn() },
    };
    customerIntelligence = { segmentSummary: jest.fn() };
    service = new MarketingIntelligenceService(
      prisma as unknown as PrismaService,
      customerIntelligence as unknown as CustomerIntelligenceService,
    );
  });

  describe("couponOptimization", () => {
    it("labels a saturated coupon that has hit its redemption cap", async () => {
      prisma.coupon.findMany.mockResolvedValue([
        { id: "c1", code: "SAT10", maxRedemptions: 100, isActive: true },
      ]);
      prisma.order.aggregate
        .mockResolvedValueOnce({ _avg: { total: 20000 } }) // baseline (no coupon)
        .mockResolvedValueOnce({ _avg: { total: 25000 } }); // this coupon's orders
      prisma.couponRedemption.count.mockResolvedValue(95);

      const [result] = await service.couponOptimization();

      expect(result!.recommendation).toBe("saturated");
    });

    it("labels an underused coupon with zero redemptions", async () => {
      prisma.coupon.findMany.mockResolvedValue([
        { id: "c1", code: "NEW10", maxRedemptions: null, isActive: true },
      ]);
      prisma.order.aggregate
        .mockResolvedValueOnce({ _avg: { total: 20000 } })
        .mockResolvedValueOnce({ _avg: { total: null } });
      prisma.couponRedemption.count.mockResolvedValue(0);

      const [result] = await service.couponOptimization();

      expect(result!.recommendation).toBe("underused");
    });

    it("labels a coupon effective when its orders' AOV beats baseline by 10%+", async () => {
      prisma.coupon.findMany.mockResolvedValue([
        { id: "c1", code: "BOOST10", maxRedemptions: null, isActive: true },
      ]);
      prisma.order.aggregate
        .mockResolvedValueOnce({ _avg: { total: 20000 } })
        .mockResolvedValueOnce({ _avg: { total: 30000 } });
      prisma.couponRedemption.count.mockResolvedValue(10);

      const [result] = await service.couponOptimization();

      expect(result!.recommendation).toBe("effective");
    });
  });

  describe("targetSuggestions", () => {
    it("maps each RFM segment to a playbook suggestion and channel", async () => {
      customerIntelligence.segmentSummary.mockResolvedValue([
        { segment: "At Risk", customerCount: 12, totalSpend: 100000 },
        { segment: "Champions", customerCount: 3, totalSpend: 500000 },
        { segment: "Empty Segment", customerCount: 0, totalSpend: 0 },
      ]);

      const result = await service.targetSuggestions(admin);

      // Zero-count segments are filtered out.
      expect(result).toHaveLength(2);
      const atRisk = result.find((s) => s.segment === "At Risk")!;
      expect(atRisk.recommendedChannel).toBe("SMS");
      expect(atRisk.suggestion.toLowerCase()).toContain("win-back");
    });
  });

  describe("loyaltyOptimization", () => {
    it("returns zeros when no one has ever accrued loyalty points", async () => {
      prisma.loyaltyLedger.groupBy.mockResolvedValue([]);

      const result = await service.loyaltyOptimization();

      expect(result).toEqual({
        activeMembers: 0,
        avgBalance: 0,
        membersNearNextTier: 0,
        totalUnredeemedPoints: 0,
      });
    });
  });
});
