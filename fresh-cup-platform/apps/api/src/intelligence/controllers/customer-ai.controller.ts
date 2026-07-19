import { Controller, Get, Param, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { CustomerAiService } from "../services/customer-ai/customer-ai.service";

@ApiTags("ai-customer")
@Controller("admin/ai/customer")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class CustomerAiController {
  constructor(private readonly customerAi: CustomerAiService) {}

  @Get(":userId/lifetime-value")
  @ApiOperation({ summary: "Predicted lifetime value for a customer" })
  @ApiOkResponse({ type: AiInsightDto })
  lifetimeValue(@CurrentUser() actor: RequestUser, @Param("userId") userId: string) {
    return this.customerAi.lifetimeValue(actor, userId);
  }

  @Get("churn-risk")
  @ApiOperation({ summary: "Customers with elevated churn risk, highest first" })
  @ApiOkResponse({ type: [AiInsightDto] })
  churnPrediction(@CurrentUser() actor: RequestUser, @Query("branchId") branchId?: string) {
    return this.customerAi.churnPrediction(actor, branchId);
  }

  @Get("behavior-clusters")
  @ApiOperation({ summary: "RFM-segment behavior clusters with size and value" })
  @ApiOkResponse({ type: [AiInsightDto] })
  behaviorClusters(@CurrentUser() actor: RequestUser, @Query("branchId") branchId?: string) {
    return this.customerAi.behaviorClusters(actor, branchId);
  }

  @Get(":userId/favorite-products")
  @ApiOperation({ summary: "A customer's favorite categories" })
  @ApiOkResponse({ type: AiInsightDto })
  favoriteProducts(@CurrentUser() actor: RequestUser, @Param("userId") userId: string) {
    return this.customerAi.favoriteProducts(actor, userId);
  }

  @Get(":userId/purchase-patterns")
  @ApiOperation({
    summary: "A customer's preferred order hour, payment method, and purchase frequency",
  })
  @ApiOkResponse({ type: AiInsightDto })
  purchasePatterns(@CurrentUser() actor: RequestUser, @Param("userId") userId: string) {
    return this.customerAi.purchasePatterns(actor, userId);
  }
}
