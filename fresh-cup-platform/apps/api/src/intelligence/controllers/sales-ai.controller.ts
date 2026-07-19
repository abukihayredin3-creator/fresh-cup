import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { SalesAiService } from "../services/sales-ai/sales-ai.service";

@ApiTags("ai-sales")
@Controller("admin/ai/sales")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class SalesAiController {
  constructor(private readonly salesAi: SalesAiService) {}

  @Get("demand-forecast")
  @ApiOperation({
    summary: "Explained sales demand forecast, backed by the nightly forecasting snapshot",
  })
  @ApiOkResponse({ type: AiInsightDto })
  demandForecast(@Query("branchId") branchId?: string) {
    return this.salesAi.demandForecast(branchId);
  }

  @Get("peak-hour")
  @ApiOperation({ summary: "Predicted peak order hour" })
  @ApiOkResponse({ type: AiInsightDto })
  peakHourPrediction(@Query("branchId") branchId?: string) {
    return this.salesAi.peakHourPrediction(branchId);
  }

  @Get("average-ticket")
  @ApiOperation({ summary: "Predicted average order value for the next forecast period" })
  @ApiOkResponse({ type: AiInsightDto })
  averageTicketPrediction(@Query("branchId") branchId?: string) {
    return this.salesAi.averageTicketPrediction(branchId);
  }

  @Get("best-sellers")
  @ApiOperation({ summary: "Predicted best-selling products over the forecast horizon" })
  @ApiOkResponse({ type: AiInsightDto })
  bestSellerPrediction(@Query("branchId") branchId?: string) {
    return this.salesAi.bestSellerPrediction(branchId);
  }

  @Get("cross-sell")
  @ApiOperation({ summary: "Cross-sell opportunities for a given menu item" })
  @ApiOkResponse({ type: AiInsightDto })
  crossSellOpportunities(@Query("menuItemId") menuItemId: string) {
    return this.salesAi.crossSellOpportunities(menuItemId);
  }
}
