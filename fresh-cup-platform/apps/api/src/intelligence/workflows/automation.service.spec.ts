import type { RequestUser } from "../../common/types/request-user.interface";
import type { ApprovalService } from "../approvals/approval.service";
import type { DeliveryAiService } from "../services/delivery-ai/delivery-ai.service";
import type { KitchenAiService } from "../services/kitchen-ai/kitchen-ai.service";
import type { MarketingAiService } from "../services/marketing-ai/marketing-ai.service";
import type { WorkforceAiService } from "../services/workforce-ai/workforce-ai.service";
import type { WorkflowEngineService } from "./workflow-engine.service";
import { AutomationService } from "./automation.service";

const ACTOR: RequestUser = { id: "u1", role: "MANAGER" as never, branchId: null };
const insight = (title: string) => ({ title, explanation: "e", confidence: 0.5, data: {} });

describe("AutomationService", () => {
  function makeService() {
    const approvals = {
      request: jest.fn().mockResolvedValue({ id: "approval-1" }),
    } as unknown as jest.Mocked<ApprovalService>;
    const workflowEngine = {
      runLowStockReorderWorkflow: jest.fn().mockResolvedValue({ id: "run-1" }),
    } as unknown as jest.Mocked<WorkflowEngineService>;
    const marketingAi = {
      campaignRecommendations: jest.fn().mockResolvedValue([]),
      couponOptimization: jest.fn().mockResolvedValue([]),
      promotionRoiPrediction: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<MarketingAiService>;
    const kitchenAi = {
      efficiencyRecommendations: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<KitchenAiService>;
    const deliveryAi = {
      driverUtilization: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DeliveryAiService>;
    const workforceAi = {
      schedulingInsights: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<WorkforceAiService>;

    const service = new AutomationService(
      approvals,
      workflowEngine,
      marketingAi,
      kitchenAi,
      deliveryAi,
      workforceAi,
    );
    return { service, approvals, workflowEngine, marketingAi, kitchenAi, deliveryAi, workforceAi };
  }

  it("draftPurchaseOrder delegates to the low-stock reorder workflow", async () => {
    const { service, workflowEngine } = makeService();
    await service.draftPurchaseOrder("b1");
    expect(workflowEngine.runLowStockReorderWorkflow).toHaveBeenCalledWith("b1");
  });

  it("draftMarketingCampaign returns null when there is no recommendation", async () => {
    const { service } = makeService();
    expect(await service.draftMarketingCampaign(ACTOR)).toBeNull();
  });

  it("draftMarketingCampaign drafts a MARKETING_CAMPAIGN approval from the top insight", async () => {
    const { service, marketingAi, approvals } = makeService();
    (marketingAi.campaignRecommendations as jest.Mock).mockResolvedValue([
      insight("Win back lapsed customers"),
    ]);

    await service.draftMarketingCampaign(ACTOR);

    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "MARKETING_CAMPAIGN",
        requestedByAgent: "automation:marketing-campaign",
      }),
    );
  });

  it("draftCouponSuggestion drafts a DISCOUNT approval", async () => {
    const { service, marketingAi, approvals } = makeService();
    (marketingAi.couponOptimization as jest.Mock).mockResolvedValue([insight("Boost slow days")]);

    await service.draftCouponSuggestion();

    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "DISCOUNT",
        requestedByAgent: "automation:coupon-suggestion",
      }),
    );
  });

  it("draftPromotionSuggestion drafts a PROMOTION approval", async () => {
    const { service, marketingAi, approvals } = makeService();
    (marketingAi.promotionRoiPrediction as jest.Mock).mockResolvedValue([
      insight("Push high-ROI promo"),
    ]);

    await service.draftPromotionSuggestion();

    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PROMOTION",
        requestedByAgent: "automation:promotion-suggestion",
      }),
    );
  });

  it.each([
    [
      "draftKitchenStaffingSuggestion",
      "kitchenAi",
      "efficiencyRecommendations",
      "automation:kitchen-staffing",
    ],
    [
      "draftDeliveryStaffingSuggestion",
      "deliveryAi",
      "driverUtilization",
      "automation:delivery-staffing",
    ],
    [
      "draftEmployeeSchedulingSuggestion",
      "workforceAi",
      "schedulingInsights",
      "automation:employee-scheduling",
    ],
  ] as const)(
    "%s drafts a STAFFING_CHANGE approval from %s.%s",
    async (method, depKey, depMethod, agent) => {
      const deps = makeService();
      const service = deps.service;
      const dep = deps[depKey] as unknown as Record<string, jest.Mock>;
      (dep[depMethod] as jest.Mock).mockResolvedValue([insight("Add one more line cook")]);

      await service[method]("b1");

      expect(deps.approvals.request).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: "STAFFING_CHANGE",
          requestedByAgent: agent,
          branchId: "b1",
        }),
      );
    },
  );
});
