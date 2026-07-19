import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CustomerIntelligenceService } from "../../../modules/intelligence/customer-intelligence/customer-intelligence.service";
import type { AiInsightDto } from "../../dto/ai-insight.dto";
import { confidenceScore } from "../../utils/confidence.util";
import { ExplanationService } from "../explanation.service";

function toBirr(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/**
 * Wraps Phase 6's CustomerIntelligenceService (RFM segmentation, churn
 * risk, predicted LTV, favorite categories, purchase patterns) — Customer
 * AI adds explanation/confidence framing, it does not recompute RFM.
 */
@Injectable()
export class CustomerAiService {
  constructor(
    private readonly customerIntelligence: CustomerIntelligenceService,
    private readonly explanation: ExplanationService,
  ) {}

  async lifetimeValue(actor: RequestUser, userId: string): Promise<AiInsightDto> {
    const profile = await this.customerIntelligence.customerProfile(actor, userId);
    const dataPoints = {
      predictedLtvEtb: toBirr(profile.predictedLtv),
      totalSpendEtb: toBirr(profile.totalSpend),
      ordersCount: profile.ordersCount,
    };
    return {
      title: `Predicted lifetime value: ${profile.fullName}`,
      explanation: await this.explanation.explain(
        `Predicted lifetime value for ${profile.fullName}`,
        dataPoints,
      ),
      confidence: confidenceScore([profile.ordersCount, profile.totalSpend]),
      data: profile,
    };
  }

  async churnPrediction(actor: RequestUser, branchId?: string): Promise<AiInsightDto[]> {
    const customers = await this.customerIntelligence.segments(actor, { branchId, limit: 100 });
    const atRisk = customers
      .filter((c) => c.segment === "At Risk" || c.segment === "Lost")
      .sort((a, b) => b.churnRisk - a.churnRisk)
      .slice(0, 10);

    return Promise.all(
      atRisk.map(async (c) => ({
        title: `Churn risk: ${c.fullName}`,
        explanation: await this.explanation.explain(`Churn risk for ${c.fullName}`, {
          churnRiskPercent: Math.round(c.churnRisk * 100),
          segment: c.segment,
          totalSpendEtb: toBirr(c.totalSpend),
        }),
        confidence: confidenceScore([c.ordersCount, c.recencyDays]),
        data: c,
      })),
    );
  }

  async behaviorClusters(actor: RequestUser, branchId?: string): Promise<AiInsightDto[]> {
    const summary = await this.customerIntelligence.segmentSummary(actor, branchId);
    return Promise.all(
      summary.map(async (s) => ({
        title: `Segment: ${s.segment}`,
        explanation: await this.explanation.explain(`Customer segment ${s.segment}`, {
          customerCount: s.customerCount,
          totalSpendEtb: toBirr(s.totalSpend),
        }),
        confidence: confidenceScore([s.customerCount]),
        data: s,
      })),
    );
  }

  async favoriteProducts(actor: RequestUser, userId: string): Promise<AiInsightDto> {
    const profile = await this.customerIntelligence.customerProfile(actor, userId);
    const dataPoints = { favoriteCategories: profile.favoriteCategories };
    return {
      title: `Favorite categories: ${profile.fullName}`,
      explanation: await this.explanation.explain(
        `Favorite categories for ${profile.fullName}`,
        dataPoints,
      ),
      confidence: confidenceScore(profile.favoriteCategories.map((c) => c.orderCount)),
      data: profile.favoriteCategories,
    };
  }

  async purchasePatterns(actor: RequestUser, userId: string): Promise<AiInsightDto> {
    const profile = await this.customerIntelligence.customerProfile(actor, userId);
    const dataPoints = {
      preferredOrderHour: profile.preferredOrderHour,
      preferredPaymentMethod: profile.preferredPaymentMethod,
      purchaseFrequencyDays: profile.purchaseFrequencyDays,
    };
    return {
      title: `Purchase patterns: ${profile.fullName}`,
      explanation: await this.explanation.explain(
        `Purchase patterns for ${profile.fullName}`,
        dataPoints,
      ),
      confidence: confidenceScore([profile.ordersCount]),
      data: dataPoints,
    };
  }
}
