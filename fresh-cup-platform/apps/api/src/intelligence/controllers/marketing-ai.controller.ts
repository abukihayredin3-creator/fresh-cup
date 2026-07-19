import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { MarketingAiService } from "../services/marketing-ai/marketing-ai.service";

@ApiTags("ai-marketing")
@Controller("admin/ai/marketing")
@Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.MARKETING_STAFF)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class MarketingAiController {
  constructor(private readonly marketingAi: MarketingAiService) {}

  @Get("campaign-recommendations")
  @ApiOperation({ summary: "Which customer segments to run a campaign against, and how" })
  @ApiOkResponse({ type: [AiInsightDto] })
  campaignRecommendations(@CurrentUser() actor: RequestUser) {
    return this.marketingAi.campaignRecommendations(actor);
  }

  @Get("coupon-optimization")
  @ApiOperation({ summary: "Coupon performance: underused, effective, or saturated" })
  @ApiOkResponse({ type: [AiInsightDto] })
  couponOptimization() {
    return this.marketingAi.couponOptimization();
  }

  @Get("promotion-roi")
  @ApiOperation({ summary: "Estimated order-volume lift from sent campaigns" })
  @ApiOkResponse({ type: [AiInsightDto] })
  promotionRoiPrediction() {
    return this.marketingAi.promotionRoiPrediction();
  }

  @Get("customer-targeting")
  @ApiOperation({
    summary: "Specific customers/segments to target: top referrers, near-next-tier loyalty members",
  })
  @ApiOkResponse({ type: [AiInsightDto] })
  customerTargeting() {
    return this.marketingAi.customerTargeting();
  }
}
