import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { MarketingIntelligenceService } from "./marketing-intelligence.service";

@ApiTags("marketing-intelligence")
@Controller("admin/marketing-intelligence")
@Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.MARKETING_STAFF)
@ApiBearerAuth()
export class MarketingIntelligenceController {
  constructor(private readonly marketingIntelligenceService: MarketingIntelligenceService) {}

  @Get("campaign-performance")
  @ApiOperation({ summary: "Estimated order-volume lift for each campaign around its send time" })
  async campaignPerformance(@Query("limit") limit?: string) {
    return this.marketingIntelligenceService.campaignPerformance(limit ? Number(limit) : undefined);
  }

  @Get("coupon-optimization")
  @ApiOperation({
    summary: "Per-coupon redemption rate and AOV impact vs baseline, with a usage recommendation",
  })
  async couponOptimization() {
    return this.marketingIntelligenceService.couponOptimization();
  }

  @Get("referral-optimization")
  @ApiOperation({
    summary: "Referral program conversion rate, cost per acquisition, and top referrers",
  })
  async referralOptimization() {
    return this.marketingIntelligenceService.referralOptimization();
  }

  @Get("loyalty-optimization")
  @ApiOperation({
    summary: "Loyalty program health: active members, average balance, near-tier-upgrade members",
  })
  async loyaltyOptimization() {
    return this.marketingIntelligenceService.loyaltyOptimization();
  }

  @Get("target-suggestions")
  @ApiOperation({ summary: "Per-RFM-segment campaign suggestions with a recommended channel" })
  async targetSuggestions(@CurrentUser() actor: RequestUser) {
    return this.marketingIntelligenceService.targetSuggestions(actor);
  }
}
