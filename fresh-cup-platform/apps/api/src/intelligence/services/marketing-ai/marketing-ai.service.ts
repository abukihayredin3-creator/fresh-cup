import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../../../common/config/env.validation";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { MarketingIntelligenceService } from "../../../modules/intelligence/marketing-intelligence/marketing-intelligence.service";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { ExplanationService } from "../explanation.service";

/**
 * Wraps Phase 6's MarketingIntelligenceService — Marketing AI adds
 * explanation/confidence framing on top of the same campaign/coupon/
 * referral/loyalty numbers, it does not recompute any of them.
 */
@Injectable()
export class MarketingAiService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly marketingIntelligence: MarketingIntelligenceService,
    private readonly explanation: ExplanationService,
  ) {}

  private assertEnabled(): void {
    if (!this.config.get("AI_MARKETING_ENABLED", { infer: true })) {
      throw new ForbiddenException(
        "Marketing AI is disabled in this environment (AI_MARKETING_ENABLED=false)",
      );
    }
  }

  async campaignRecommendations(actor: RequestUser): Promise<AiInsightDto[]> {
    this.assertEnabled();
    const suggestions = await this.marketingIntelligence.targetSuggestions(actor);
    return Promise.all(
      suggestions.map(async (s) => ({
        title: `Campaign recommendation: ${s.segment}`,
        explanation: await this.explanation.explain(`Campaign recommendation for ${s.segment}`, {
          customerCount: s.customerCount,
          suggestion: s.suggestion,
          recommendedChannel: s.recommendedChannel,
        }),
        confidence: confidenceScore([s.customerCount]),
        data: s,
      })),
    );
  }

  async couponOptimization(): Promise<AiInsightDto[]> {
    this.assertEnabled();
    const coupons = await this.marketingIntelligence.couponOptimization();
    return Promise.all(
      coupons.map(async (c) => ({
        title: `Coupon: ${c.code}`,
        explanation: await this.explanation.explain(`Coupon performance for ${c.code}`, {
          redemptionCount: c.redemptionCount,
          recommendation: c.recommendation,
        }),
        confidence: confidenceScore([c.redemptionCount]),
        data: c,
      })),
    );
  }

  async promotionRoiPrediction(): Promise<AiInsightDto[]> {
    this.assertEnabled();
    const campaigns = await this.marketingIntelligence.campaignPerformance();
    return Promise.all(
      campaigns
        .filter((c) => c.estimatedOrderLiftPercent !== null)
        .map(async (c) => ({
          title: `Promotion ROI: ${c.name}`,
          explanation: await this.explanation.explain(`Promotion ROI for ${c.name}`, {
            estimatedOrderLiftPercent: c.estimatedOrderLiftPercent,
            channel: c.channel,
          }),
          confidence: confidenceScore([c.recipientCount ?? 0]),
          data: c,
        })),
    );
  }

  async customerTargeting(): Promise<AiInsightDto[]> {
    this.assertEnabled();
    const [referral, loyalty] = await Promise.all([
      this.marketingIntelligence.referralOptimization(),
      this.marketingIntelligence.loyaltyOptimization(),
    ]);

    const insights: AiInsightDto[] = [];
    if (referral.topReferrers.length > 0) {
      const dataPoints = {
        topReferrers: referral.topReferrers,
        conversionRate: referral.conversionRate,
      };
      insights.push({
        title: "Referral network targeting",
        explanation: await this.explanation.explain("Referral network targeting", dataPoints),
        confidence: confidenceScore(referral.topReferrers.map((r) => r.usesCount)),
        data: dataPoints,
      });
    }
    if (loyalty.membersNearNextTier > 0) {
      const dataPoints = {
        membersNearNextTier: loyalty.membersNearNextTier,
        activeMembers: loyalty.activeMembers,
      };
      insights.push({
        title: "Loyalty tier-upgrade targeting",
        explanation: await this.explanation.explain("Loyalty tier-upgrade targeting", dataPoints),
        confidence: confidenceScore([loyalty.membersNearNextTier, loyalty.activeMembers]),
        data: dataPoints,
      });
    }
    return insights;
  }
}
