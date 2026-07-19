import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { AiInsightDto } from "../dto/ai-insight.dto";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { InventoryAiService } from "../services/inventory-ai/inventory-ai.service";

@ApiTags("ai-inventory")
@Controller("admin/ai/inventory")
@Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.INVENTORY_STAFF)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class InventoryAiController {
  constructor(private readonly inventoryAi: InventoryAiService) {}

  @Get("restocking")
  @ApiOperation({ summary: "Explained restocking recommendations" })
  @ApiOkResponse({ type: [AiInsightDto] })
  restockingRecommendations(@Query("branchId") branchId?: string) {
    return this.inventoryAi.restockingRecommendations(branchId);
  }

  @Get("waste-prediction")
  @ApiOperation({ summary: "Ingredients at elevated risk of waste" })
  @ApiOkResponse({ type: [AiInsightDto] })
  wastePrediction(@Query("branchId") branchId?: string) {
    return this.inventoryAi.wastePrediction(branchId);
  }

  @Get("ingredient-demand-forecast")
  @ApiOperation({ summary: "Forecasted ingredient demand over the horizon" })
  @ApiOkResponse({ type: AiInsightDto })
  ingredientDemandForecast(@Query("branchId") branchId?: string) {
    return this.inventoryAi.ingredientDemandForecast(branchId);
  }

  @Get("supplier-optimization")
  @ApiOperation({
    summary: "Supplier lead-time and reliability scoring, from purchase order history",
  })
  @ApiOkResponse({ type: [AiInsightDto] })
  supplierOptimization(@Query("branchId") branchId?: string) {
    return this.inventoryAi.supplierOptimization(branchId);
  }
}
