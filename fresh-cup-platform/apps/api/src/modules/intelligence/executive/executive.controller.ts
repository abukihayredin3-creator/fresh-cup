import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ForecastGranularity, ForecastMetric, UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DateRangeQueryDto } from "../../analytics/dto/date-range-query.dto";
import { ForecastingService } from "../forecasting/forecasting.service";
import { ExecutiveOverviewDto } from "./dto/executive-overview.dto";
import { ExecutiveService } from "./executive.service";

@ApiTags("executive")
@Controller("admin/executive")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
export class ExecutiveController {
  constructor(
    private readonly executiveService: ExecutiveService,
    private readonly forecastingService: ForecastingService,
  ) {}

  @Get("overview")
  @ApiOperation({
    summary:
      "Everything for the executive dashboard: revenue/profit trend, product profitability, branch comparison, customer growth, peak hours, repeat rate, conversion, inventory costs, marketing ROI",
  })
  @ApiOkResponse({ type: ExecutiveOverviewDto })
  async overview(
    @CurrentUser() actor: RequestUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<ExecutiveOverviewDto> {
    return this.executiveService.overview(actor, query);
  }

  @Get("forecast-vs-actual")
  @ApiOperation({ summary: "Predicted vs actual daily revenue for the forecast horizon" })
  async forecastVsActual(@Query("branchId") branchId?: string) {
    const { modelVersion, points } = await this.forecastingService.series(
      ForecastMetric.SALES_REVENUE,
      ForecastGranularity.DAILY,
      branchId,
    );
    return {
      modelVersion,
      points: points.map((p) => ({
        targetPeriodStart: p.targetPeriodStart.toISOString(),
        predictedValue: Number(p.predictedValue),
        actualValue: p.actualValue !== null ? Number(p.actualValue) : null,
      })),
    };
  }
}
