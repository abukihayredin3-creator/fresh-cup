import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { KitchenAiService } from "../services/kitchen-ai/kitchen-ai.service";

@ApiTags("ai-kitchen")
@Controller("admin/ai/kitchen")
@Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.KITCHEN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class KitchenAiController {
  constructor(private readonly kitchenAi: KitchenAiService) {}

  @Get("bottlenecks")
  @ApiOperation({ summary: "Kitchen stations where actual prep time is overrunning estimates" })
  @ApiOkResponse({ type: [AiInsightDto] })
  prepBottlenecks(@Query("branchId") branchId?: string) {
    return this.kitchenAi.prepBottlenecks(branchId);
  }

  @Get("station-workload")
  @ApiOperation({ summary: "Items prepared per station over the trailing 30 days" })
  @ApiOkResponse({ type: [AiInsightDto] })
  stationWorkload(@Query("branchId") branchId?: string) {
    return this.kitchenAi.stationWorkload(branchId);
  }

  @Get("prep-time-anomalies")
  @ApiOperation({ summary: "Orders whose prep time was a statistical outlier" })
  @ApiOkResponse({ type: [AiInsightDto] })
  prepTimeAnomalies(@Query("branchId") branchId?: string) {
    return this.kitchenAi.prepTimeAnomalies(branchId);
  }

  @Get("efficiency-recommendations")
  @ApiOperation({ summary: "Stations with a persistent, actionable bottleneck pattern" })
  @ApiOkResponse({ type: [AiInsightDto] })
  efficiencyRecommendations(@Query("branchId") branchId?: string) {
    return this.kitchenAi.efficiencyRecommendations(branchId);
  }
}
