import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { AutomationService } from "./automation.service";
import { BranchScopedDto } from "./dto/branch-scoped.dto";
import { RunWorkflowDto } from "./dto/run-workflow.dto";

/** AI Automation — drafts a suggestion into the Human Approval Layer; never executes anything directly. */
@ApiTags("ai-automation")
@Controller("admin/ai/automation")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Post("purchase-order-draft")
  @ApiOperation({ summary: "Draft a purchase order from current low-stock items" })
  purchaseOrderDraft(@Body() dto: RunWorkflowDto) {
    return this.automation.draftPurchaseOrder(dto.branchId);
  }

  @Post("marketing-campaign-draft")
  @ApiOperation({ summary: "Draft a marketing campaign from the top recommendation" })
  marketingCampaignDraft(@CurrentUser() actor: RequestUser) {
    return this.automation.draftMarketingCampaign(actor);
  }

  @Post("coupon-draft")
  @ApiOperation({ summary: "Draft a coupon from the top coupon-optimization insight" })
  couponDraft() {
    return this.automation.draftCouponSuggestion();
  }

  @Post("promotion-draft")
  @ApiOperation({ summary: "Draft a promotion from the top promotion ROI insight" })
  promotionDraft() {
    return this.automation.draftPromotionSuggestion();
  }

  @Post("kitchen-staffing-draft")
  @ApiOperation({ summary: "Draft a kitchen staffing suggestion" })
  kitchenStaffingDraft(@Body() dto: BranchScopedDto) {
    return this.automation.draftKitchenStaffingSuggestion(dto.branchId);
  }

  @Post("delivery-staffing-draft")
  @ApiOperation({ summary: "Draft a delivery staffing suggestion" })
  deliveryStaffingDraft(@Body() dto: BranchScopedDto) {
    return this.automation.draftDeliveryStaffingSuggestion(dto.branchId);
  }

  @Post("employee-scheduling-draft")
  @ApiOperation({ summary: "Draft an employee scheduling suggestion" })
  employeeSchedulingDraft(@Body() dto: BranchScopedDto) {
    return this.automation.draftEmployeeSchedulingSuggestion(dto.branchId);
  }
}
