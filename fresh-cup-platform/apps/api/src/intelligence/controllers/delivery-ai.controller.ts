import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { DeliveryAiService } from "../services/delivery-ai/delivery-ai.service";

@ApiTags("ai-delivery")
@Controller("admin/ai/delivery")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class DeliveryAiController {
  constructor(private readonly deliveryAi: DeliveryAiService) {}

  @Get("eta")
  @ApiOperation({
    summary:
      "Predicted delivery duration for a given distance, from the fleet's recent average speed",
  })
  @ApiOkResponse({ type: AiInsightDto })
  etaPrediction(@Query("distanceKm") distanceKm: string, @Query("branchId") branchId?: string) {
    return this.deliveryAi.etaPrediction(Number(distanceKm), branchId);
  }

  @Get("delays")
  @ApiOperation({ summary: "In-flight deliveries running well past their expected duration" })
  @ApiOkResponse({ type: [AiInsightDto] })
  delayDetection(@Query("branchId") branchId?: string) {
    return this.deliveryAi.delayDetection(branchId);
  }

  @Get("zone-optimization")
  @ApiOperation({ summary: "Per-zone delivery fee, distance, and volume, for pricing review" })
  @ApiOkResponse({ type: [AiInsightDto] })
  zoneOptimization(@Query("branchId") branchId?: string) {
    return this.deliveryAi.zoneOptimization(branchId);
  }

  @Get("driver-utilization")
  @ApiOperation({ summary: "Per-driver delivery volume and average duration" })
  @ApiOkResponse({ type: [AiInsightDto] })
  driverUtilization(@Query("branchId") branchId?: string) {
    return this.deliveryAi.driverUtilization(branchId);
  }
}
