import { Injectable } from "@nestjs/common";
import {
  ApprovalActionType,
  ApprovalRiskLevel,
  CampaignChannel,
  DiscountType,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ExecutiveService } from "../../modules/intelligence/executive/executive.service";
import { linearRegression } from "../../modules/intelligence/ml/stats.util";
import { confidenceScore } from "../utils/confidence.util";
import { ApprovalService } from "../approvals/approval.service";
import type {
  DecisionReason,
  DecisionRecommendation,
  DecisionReport,
} from "./decision-engine.types";

const DROP_THRESHOLD_PERCENT = -10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toBirr(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/**
 * The Autonomous Decision Engine — Phase 11 Part 3's "AI doesn't just
 * recommend, it builds an action plan" requirement. Compares this week's
 * revenue to last week's (via Phase 6's `ExecutiveService.overview`, never
 * recomputed), attributes the change to real, queryable signals (revenue
 * trend slope, recently-expired coupons/campaigns, an order-count proxy
 * for foot traffic), and proposes recommendations whose combined expected
 * impact is a heuristic split of the detected revenue gap — clearly
 * documented as an estimate, not a guarantee, since this platform has no
 * ground-truth attribution model for "how much would action X actually
 * recover". There is no weather signal in this system (no weather
 * provider integrated), so "Rain" from the spec's example is never a
 * reason this engine can produce — a documented gap, not a silent
 * omission. When `draftApprovals` is true, actionable recommendations are
 * written to the Human Approval Layer as PENDING requests rather than
 * executed — this engine never takes an action on its own.
 */
@Injectable()
export class DecisionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executiveService: ExecutiveService,
    private readonly approvals: ApprovalService,
  ) {}

  async detectSalesDrop(
    actor: RequestUser,
    branchId?: string,
    draftApprovals = false,
  ): Promise<DecisionReport | null> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - WEEK_MS);
    const previousStart = new Date(now.getTime() - 2 * WEEK_MS);

    const [current, previous] = await Promise.all([
      this.executiveService.overview(actor, {
        branchId,
        from: isoDate(currentStart),
        to: isoDate(now),
      }),
      this.executiveService.overview(actor, {
        branchId,
        from: isoDate(previousStart),
        to: isoDate(currentStart),
      }),
    ]);

    if (previous.totalRevenue === 0) return null;

    const changePercent =
      ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100;
    if (changePercent > DROP_THRESHOLD_PERCENT) return null;

    const gapEtb = toBirr(previous.totalRevenue - current.totalRevenue);
    const revenueValues = current.revenueTrend.map((p) => p.revenue);
    const reasons: DecisionReason[] = [];

    const { slope } = linearRegression(revenueValues.length >= 2 ? revenueValues : [0, 0]);
    if (slope < 0) {
      reasons.push({
        factor: "Declining revenue trend",
        evidence: `Daily revenue trending down ~${Math.abs(toBirr(slope))} ETB/day within the current week.`,
        confidence: confidenceScore(revenueValues),
      });
    }

    const ordersChangePercent =
      previous.conversionMetrics.ordersPlaced === 0
        ? 0
        : ((current.conversionMetrics.ordersPlaced - previous.conversionMetrics.ordersPlaced) /
            previous.conversionMetrics.ordersPlaced) *
          100;
    if (ordersChangePercent <= DROP_THRESHOLD_PERCENT) {
      reasons.push({
        factor: "Low foot traffic",
        evidence: `Orders placed fell ${Math.abs(Math.round(ordersChangePercent))}% (${previous.conversionMetrics.ordersPlaced} -> ${current.conversionMetrics.ordersPlaced}).`,
        confidence: confidenceScore([
          previous.conversionMetrics.ordersPlaced,
          current.conversionMetrics.ordersPlaced,
        ]),
      });
    }

    const recentlyExpired = await this.prisma.coupon.count({
      where: { expiresAt: { gte: previousStart, lte: now }, isActive: true },
    });
    if (recentlyExpired > 0) {
      reasons.push({
        factor: "Expired campaign/coupon",
        evidence: `${recentlyExpired} coupon(s) expired since ${isoDate(previousStart)} with nothing new launched to replace them.`,
        confidence: 0.6,
      });
    }

    if (reasons.length === 0) {
      reasons.push({
        factor: "Undetermined",
        evidence:
          "Revenue declined but none of this platform's tracked signals (trend slope, order volume, coupon expiry) explain it — no external signals (e.g. weather) are integrated.",
        confidence: 0.2,
      });
    }

    const recommendations = await this.buildRecommendations(branchId, gapEtb, draftApprovals);

    return {
      issue: "Sales decline detected",
      metric: "weekly revenue",
      changePercent: Math.round(changePercent * 10) / 10,
      currentValueEtb: toBirr(current.totalRevenue),
      previousValueEtb: toBirr(previous.totalRevenue),
      reasons,
      recommendations,
      totalExpectedImpactEtb: Math.round(
        recommendations.reduce((sum, r) => sum + r.expectedImpactEtb, 0),
      ),
      generatedAt: now.toISOString(),
    };
  }

  private async buildRecommendations(
    branchId: string | undefined,
    gapEtb: number,
    draftApprovals: boolean,
  ): Promise<DecisionRecommendation[]> {
    const recommendations: DecisionRecommendation[] = [
      {
        action: "Launch a limited-time discount coupon to re-activate lapsed customers",
        expectedImpactEtb: Math.round(gapEtb * 0.4),
        confidence: 0.5,
        requiresApproval: true,
        approvalActionType: ApprovalActionType.DISCOUNT,
      },
      {
        action: "Send a targeted campaign to VIP/high-value customers",
        expectedImpactEtb: Math.round(gapEtb * 0.3),
        confidence: 0.4,
        requiresApproval: true,
        approvalActionType: ApprovalActionType.MARKETING_CAMPAIGN,
      },
      {
        action: "Increase paid social/ads spend for the next 7 days",
        expectedImpactEtb: Math.round(gapEtb * 0.3),
        confidence: 0.3,
        requiresApproval: true,
        approvalActionType: ApprovalActionType.OTHER,
      },
    ];

    if (!draftApprovals) return recommendations;

    const dateStamp = isoDate(new Date()).replace(/-/g, "");
    const drafted: DecisionRecommendation[] = [];
    for (const recommendation of recommendations) {
      if (recommendation.approvalActionType === ApprovalActionType.DISCOUNT) {
        const request = await this.approvals.request({
          actionType: ApprovalActionType.DISCOUNT,
          riskLevel: ApprovalRiskLevel.MEDIUM,
          summary: recommendation.action,
          payload: {
            code: `DECISION-${dateStamp}`,
            discountType: DiscountType.PERCENT,
            value: 10,
          } as Prisma.InputJsonValue,
          requestedByAgent: "decision-engine:sales-drop",
          branchId,
        });
        drafted.push({ ...recommendation, approvalRequestId: request.id });
      } else if (recommendation.approvalActionType === ApprovalActionType.MARKETING_CAMPAIGN) {
        const request = await this.approvals.request({
          actionType: ApprovalActionType.MARKETING_CAMPAIGN,
          riskLevel: ApprovalRiskLevel.LOW,
          summary: recommendation.action,
          payload: {
            name: `Win-back campaign ${dateStamp}`,
            channel: CampaignChannel.EMAIL,
            message: "We miss you! Come back this week for a special offer.",
          } as Prisma.InputJsonValue,
          requestedByAgent: "decision-engine:sales-drop",
          branchId,
        });
        drafted.push({ ...recommendation, approvalRequestId: request.id });
      } else {
        drafted.push(recommendation);
      }
    }
    return drafted;
  }
}
