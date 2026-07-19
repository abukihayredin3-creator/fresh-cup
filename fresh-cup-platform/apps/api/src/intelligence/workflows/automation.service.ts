import { Injectable } from "@nestjs/common";
import {
  ApprovalActionType,
  ApprovalRiskLevel,
  CampaignChannel,
  DiscountType,
} from "@prisma/client";
import type { AiApprovalRequest, Prisma } from "@prisma/client";
import type { RequestUser } from "../../common/types/request-user.interface";
import { ApprovalService } from "../approvals/approval.service";
import { DeliveryAiService } from "../services/delivery-ai/delivery-ai.service";
import { KitchenAiService } from "../services/kitchen-ai/kitchen-ai.service";
import { MarketingAiService } from "../services/marketing-ai/marketing-ai.service";
import { WorkforceAiService } from "../services/workforce-ai/workforce-ai.service";
import { WorkflowEngineService } from "./workflow-engine.service";

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * AI Automation (Phase 11 Part 3) — turns an existing domain AI insight
 * into a draft the Human Approval Layer can act on, rather than a new
 * prediction engine. Forecasts are already automatic (Phase 6's nightly
 * regeneration, Part 2's retraining scheduler) and never gated behind
 * approval since they don't write anything — only the action-taking
 * drafts below go through `ApprovalService`. Kitchen/delivery/employee
 * staffing suggestions are drafted as `STAFFING_CHANGE`, which (see
 * `ApprovalExecutorRegistry`) has no automatic executor — approving one
 * still requires a manager to act on it through the existing staff
 * scheduling screens; the draft's value is surfacing the suggestion in
 * one inbox, not auto-editing a shift.
 */
@Injectable()
export class AutomationService {
  constructor(
    private readonly approvals: ApprovalService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly marketingAi: MarketingAiService,
    private readonly kitchenAi: KitchenAiService,
    private readonly deliveryAi: DeliveryAiService,
    private readonly workforceAi: WorkforceAiService,
  ) {}

  draftPurchaseOrder(branchId: string) {
    return this.workflowEngine.runLowStockReorderWorkflow(branchId);
  }

  async draftMarketingCampaign(actor: RequestUser): Promise<AiApprovalRequest | null> {
    const [top] = await this.marketingAi.campaignRecommendations(actor);
    if (!top) return null;
    return this.approvals.request({
      actionType: ApprovalActionType.MARKETING_CAMPAIGN,
      riskLevel: ApprovalRiskLevel.LOW,
      summary: top.title,
      payload: {
        name: `${top.title} ${dateStamp()}`,
        channel: CampaignChannel.EMAIL,
        message: top.explanation,
      } as Prisma.InputJsonValue,
      requestedByAgent: "automation:marketing-campaign",
    });
  }

  async draftCouponSuggestion(): Promise<AiApprovalRequest | null> {
    const [top] = await this.marketingAi.couponOptimization();
    if (!top) return null;
    return this.approvals.request({
      actionType: ApprovalActionType.DISCOUNT,
      riskLevel: ApprovalRiskLevel.MEDIUM,
      summary: top.title,
      payload: {
        code: `AUTO-${dateStamp()}`,
        discountType: DiscountType.PERCENT,
        value: 10,
      } as Prisma.InputJsonValue,
      requestedByAgent: "automation:coupon-suggestion",
    });
  }

  async draftPromotionSuggestion(): Promise<AiApprovalRequest | null> {
    const [top] = await this.marketingAi.promotionRoiPrediction();
    if (!top) return null;
    return this.approvals.request({
      actionType: ApprovalActionType.PROMOTION,
      riskLevel: ApprovalRiskLevel.LOW,
      summary: top.title,
      payload: {
        name: `${top.title} ${dateStamp()}`,
        channel: CampaignChannel.PUSH,
        message: top.explanation,
      } as Prisma.InputJsonValue,
      requestedByAgent: "automation:promotion-suggestion",
    });
  }

  async draftKitchenStaffingSuggestion(branchId?: string): Promise<AiApprovalRequest | null> {
    const [top] = await this.kitchenAi.efficiencyRecommendations(branchId);
    if (!top) return null;
    return this.approvals.request({
      actionType: ApprovalActionType.STAFFING_CHANGE,
      riskLevel: ApprovalRiskLevel.LOW,
      summary: `Kitchen staffing: ${top.title}`,
      payload: {
        area: "kitchen",
        suggestion: top.explanation,
        data: top.data,
      } as Prisma.InputJsonValue,
      requestedByAgent: "automation:kitchen-staffing",
      branchId,
    });
  }

  async draftDeliveryStaffingSuggestion(branchId?: string): Promise<AiApprovalRequest | null> {
    const [top] = await this.deliveryAi.driverUtilization(branchId);
    if (!top) return null;
    return this.approvals.request({
      actionType: ApprovalActionType.STAFFING_CHANGE,
      riskLevel: ApprovalRiskLevel.LOW,
      summary: `Delivery staffing: ${top.title}`,
      payload: {
        area: "delivery",
        suggestion: top.explanation,
        data: top.data,
      } as Prisma.InputJsonValue,
      requestedByAgent: "automation:delivery-staffing",
      branchId,
    });
  }

  async draftEmployeeSchedulingSuggestion(branchId?: string): Promise<AiApprovalRequest | null> {
    const [top] = await this.workforceAi.schedulingInsights(branchId);
    if (!top) return null;
    return this.approvals.request({
      actionType: ApprovalActionType.STAFFING_CHANGE,
      riskLevel: ApprovalRiskLevel.LOW,
      summary: `Employee scheduling: ${top.title}`,
      payload: {
        area: "scheduling",
        suggestion: top.explanation,
        data: top.data,
      } as Prisma.InputJsonValue,
      requestedByAgent: "automation:employee-scheduling",
      branchId,
    });
  }
}
