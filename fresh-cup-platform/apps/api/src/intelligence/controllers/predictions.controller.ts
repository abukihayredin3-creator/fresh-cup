import { Controller, Get, Param, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { CustomerPredictionService } from "../prediction/customer-prediction.service";

/** `/ai/predictions` from the Phase 11 Part 2 spec's AI API surface. */
@ApiTags("ai-predictions")
@Controller("admin/ai/predictions")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class PredictionsController {
  constructor(private readonly customerPrediction: CustomerPredictionService) {}

  @Get("customer/:userId")
  @ApiOperation({
    summary:
      "All 8 customer-intelligence predictions for one customer: CLV, repeat purchase, churn, upsell, cross-sell, coupon response, referral, satisfaction",
  })
  allPredictions(@CurrentUser() actor: RequestUser, @Param("userId") userId: string) {
    return this.customerPrediction.allPredictions(actor, userId);
  }
}
