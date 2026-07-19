import { Injectable } from "@nestjs/common";
import { CampaignStatus, OrderStatus } from "@prisma/client";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import { CustomerIntelligenceService } from "../customer-intelligence/customer-intelligence.service";
import type {
  CampaignPerformanceDto,
  CouponOptimizationDto,
  LoyaltyOptimizationDto,
  ReferralOptimizationDto,
  TargetSuggestionDto,
} from "./dto/marketing-intelligence.dto";

const COUNTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

const SEGMENT_PLAYBOOK: Record<string, { suggestion: string; channel: string }> = {
  Champions: {
    suggestion: "Invite to a referral or loyalty-tier push — they're your best advocates",
    channel: "PUSH",
  },
  "Loyal Customers": {
    suggestion: "Offer an early-access or exclusive-item promotion to deepen loyalty",
    channel: "EMAIL",
  },
  "New Customers": {
    suggestion: "Send an onboarding offer to encourage a second order",
    channel: "SMS",
  },
  "At Risk": { suggestion: "Send a win-back coupon before they lapse into Lost", channel: "SMS" },
  "Need Attention": {
    suggestion: "A modest discount or reminder can nudge frequency back up",
    channel: "PUSH",
  },
  Lost: {
    suggestion: "A high-value win-back offer, or accept the acquisition cost of re-earning them",
    channel: "EMAIL",
  },
};

/**
 * Marketing intelligence is analysis over the existing Phase 5 marketing
 * tables (Campaign/Coupon/GiftCard/ReferralCode) plus Phase 6's customer
 * segmentation — no new sends, no new campaign infrastructure. It answers
 * "what should the next campaign be" and "how did the last one do", not
 * "send this campaign" (that stays CampaignsService's job).
 */
@Injectable()
export class MarketingIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerIntelligence: CustomerIntelligenceService,
  ) {}

  async campaignPerformance(limit = 20): Promise<CampaignPerformanceDto[]> {
    const campaigns = await this.prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return Promise.all(
      campaigns.map(async (campaign) => {
        let estimatedOrderLiftPercent: number | null = null;
        if (campaign.status === CampaignStatus.SENT && campaign.sentAt) {
          const windowMs = 72 * 60 * 60 * 1000;
          const [after, before] = await Promise.all([
            this.prisma.order.count({
              where: {
                status: { in: COUNTED_STATUSES },
                placedAt: {
                  gte: campaign.sentAt,
                  lt: new Date(campaign.sentAt.getTime() + windowMs),
                },
              },
            }),
            this.prisma.order.count({
              where: {
                status: { in: COUNTED_STATUSES },
                placedAt: {
                  gte: new Date(campaign.sentAt.getTime() - windowMs),
                  lt: campaign.sentAt,
                },
              },
            }),
          ]);
          estimatedOrderLiftPercent =
            before > 0 ? Math.round(((after - before) / before) * 1000) / 10 : null;
        }

        return {
          campaignId: campaign.id,
          name: campaign.name,
          channel: campaign.channel,
          recipientCount: campaign.recipientCount,
          sentAt: campaign.sentAt?.toISOString() ?? null,
          estimatedOrderLiftPercent,
        };
      }),
    );
  }

  async couponOptimization(): Promise<CouponOptimizationDto[]> {
    const coupons = await this.prisma.coupon.findMany({ where: { isActive: true } });
    const baselineAgg = await this.prisma.order.aggregate({
      where: { status: { in: COUNTED_STATUSES }, couponId: null },
      _avg: { total: true },
    });
    const baseline = Math.round(baselineAgg._avg.total ?? 0);

    return Promise.all(
      coupons.map(async (coupon) => {
        const [redemptionCount, orderAgg] = await Promise.all([
          this.prisma.couponRedemption.count({ where: { couponId: coupon.id } }),
          this.prisma.order.aggregate({
            where: { couponId: coupon.id, status: { in: COUNTED_STATUSES } },
            _avg: { total: true },
          }),
        ]);
        const avgOrderValueWithCoupon = Math.round(orderAgg._avg.total ?? 0);

        let recommendation = "underused";
        if (coupon.maxRedemptions && redemptionCount >= coupon.maxRedemptions * 0.9) {
          recommendation = "saturated";
        } else if (avgOrderValueWithCoupon >= baseline * 1.1 && redemptionCount > 0) {
          recommendation = "effective";
        }

        return {
          couponId: coupon.id,
          code: coupon.code,
          redemptionCount,
          maxRedemptions: coupon.maxRedemptions,
          avgOrderValueWithCoupon,
          avgOrderValueBaseline: baseline,
          recommendation,
        };
      }),
    );
  }

  async referralOptimization(): Promise<ReferralOptimizationDto> {
    const [codes, redemptions, topCodes] = await Promise.all([
      this.prisma.referralCode.count(),
      this.prisma.referralRedemption.count(),
      this.prisma.referralCode.findMany({
        orderBy: { usesCount: "desc" },
        take: 10,
        include: { user: { select: { fullName: true } } },
      }),
    ]);

    const rewardAgg = await this.prisma.referralCode.aggregate({
      where: { usesCount: { gt: 0 } },
      _avg: { rewardAmount: true },
    });

    return {
      totalCodesIssued: codes,
      totalRedemptions: redemptions,
      conversionRate: codes > 0 ? Math.round((redemptions / codes) * 1000) / 1000 : 0,
      avgRewardCostPerAcquisition: Math.round(rewardAgg._avg.rewardAmount ?? 0),
      topReferrers: topCodes
        .filter((c) => c.usesCount > 0)
        .map((c) => ({ userId: c.userId, fullName: c.user.fullName, usesCount: c.usesCount })),
    };
  }

  async loyaltyOptimization(): Promise<LoyaltyOptimizationDto> {
    const latestPerUser = await this.prisma.loyaltyLedger.groupBy({
      by: ["userId"],
      _max: { createdAt: true },
    });
    if (latestPerUser.length === 0) {
      return { activeMembers: 0, avgBalance: 0, membersNearNextTier: 0, totalUnredeemedPoints: 0 };
    }

    const latestEntries = await Promise.all(
      latestPerUser.map((row) =>
        this.prisma.loyaltyLedger.findFirst({
          where: { userId: row.userId, createdAt: row._max.createdAt! },
          select: { balanceAfter: true },
        }),
      ),
    );
    const balances = latestEntries.map((e) => e?.balanceAfter ?? 0);
    const tierThresholds = [500, 2000];
    const nearNextTier = balances.filter((b) =>
      tierThresholds.some((threshold) => b < threshold && b >= threshold - 150),
    ).length;

    return {
      activeMembers: balances.length,
      avgBalance: Math.round(balances.reduce((sum, b) => sum + b, 0) / balances.length),
      membersNearNextTier: nearNextTier,
      totalUnredeemedPoints: balances.reduce((sum, b) => sum + b, 0),
    };
  }

  async targetSuggestions(actor: RequestUser): Promise<TargetSuggestionDto[]> {
    const summary = await this.customerIntelligence.segmentSummary(actor, undefined);
    return summary
      .filter((s) => s.customerCount > 0)
      .map((s) => {
        const playbook = SEGMENT_PLAYBOOK[s.segment] ?? {
          suggestion: "Review this segment for a targeted offer",
          channel: "EMAIL",
        };
        return {
          segment: s.segment,
          customerCount: s.customerCount,
          suggestion: playbook.suggestion,
          recommendedChannel: playbook.channel,
        };
      });
  }
}
