import { Controller, Get, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { SecretRedactionInterceptor } from "../interceptors/secret-redaction.interceptor";
import { ForecastingFacadeService } from "../forecasting/forecasting-facade.service";

/** `/ai/forecast` from the Phase 11 Part 2 spec's AI API surface — wraps Phase 6/Part 1 forecasts as explainable PredictionResultDto. */
@ApiTags("ai-forecast")
@Controller("admin/ai/forecast")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(SecretRedactionInterceptor)
export class ForecastController {
  constructor(private readonly forecast: ForecastingFacadeService) {}

  @Get("hourly-sales")
  @ApiOperation({ summary: "Hourly sales/demand forecast" })
  hourlySales(@Query("branchId") branchId?: string) {
    return this.forecast.hourlySales(branchId);
  }

  @Get("daily-sales")
  @ApiOperation({ summary: "Daily sales revenue forecast" })
  dailySales(@Query("branchId") branchId?: string) {
    return this.forecast.dailySales(branchId);
  }

  @Get("weekly-sales")
  @ApiOperation({ summary: "Weekly sales revenue forecast" })
  weeklySales(@Query("branchId") branchId?: string) {
    return this.forecast.weeklySales(branchId);
  }

  @Get("monthly-sales")
  @ApiOperation({ summary: "Monthly sales revenue forecast" })
  monthlySales(@Query("branchId") branchId?: string) {
    return this.forecast.monthlySales(branchId);
  }

  @Get("revenue")
  @ApiOperation({ summary: "Next-period revenue forecast" })
  revenue(@Query("branchId") branchId?: string) {
    return this.forecast.revenue(branchId);
  }

  @Get("transactions")
  @ApiOperation({ summary: "Next-period order-count (transactions) forecast" })
  transactions(@Query("branchId") branchId?: string) {
    return this.forecast.transactions(branchId);
  }

  @Get("average-ticket")
  @ApiOperation({ summary: "Predicted average order value for the next period" })
  averageTicket(@Query("branchId") branchId?: string) {
    return this.forecast.averageTicket(branchId);
  }

  @Get("best-sellers")
  @ApiOperation({ summary: "Predicted best-selling products over the forecast horizon" })
  bestSellers(@Query("branchId") branchId?: string) {
    return this.forecast.bestSellers(branchId);
  }

  @Get("category-trends")
  @ApiOperation({
    summary: "Predicted product demand grouped by menu category, ranked and trend-labeled",
  })
  categoryTrends(@Query("branchId") branchId?: string) {
    return this.forecast.categoryTrends(branchId);
  }
}
