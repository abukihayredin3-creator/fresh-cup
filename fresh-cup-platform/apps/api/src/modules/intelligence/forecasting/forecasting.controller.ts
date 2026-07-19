import { Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ForecastGranularity, ForecastMetric, UserRole } from "@prisma/client";
import { Roles } from "../../../common/decorators/roles.decorator";
import { ModelRegistryService } from "../ml/model-registry.service";
import { ForecastQueryDto } from "./dto/forecast-query.dto";
import { ForecastSeriesDto } from "./dto/forecast-point.dto";
import { ForecastingService } from "./forecasting.service";

@ApiTags("forecasting")
@Controller("admin/forecasting")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
export class ForecastingController {
  constructor(
    private readonly forecastingService: ForecastingService,
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  @Get("sales")
  @ApiOperation({
    summary: "Sales forecast series (revenue/orders) with actual-vs-predicted once available",
  })
  @ApiOkResponse({ type: ForecastSeriesDto })
  async sales(@Query() query: ForecastQueryDto): Promise<ForecastSeriesDto> {
    const metric = query.metric ?? ForecastMetric.SALES_REVENUE;
    const granularity = query.granularity ?? ForecastGranularity.DAILY;
    const { modelVersion, points } = await this.forecastingService.series(
      metric,
      granularity,
      query.branchId,
    );
    return {
      metric,
      granularity,
      modelVersion,
      points: points.map((p) => ({
        targetPeriodStart: p.targetPeriodStart.toISOString(),
        predictedValue: Number(p.predictedValue),
        actualValue: p.actualValue !== null ? Number(p.actualValue) : null,
        confidence: Number(p.confidence),
      })),
    };
  }

  @Get("hourly-demand")
  @ApiOperation({ summary: "Predicted order volume per hour-of-day for tomorrow" })
  async hourlyDemand(@Query("branchId") branchId?: string) {
    return this.forecastingService.hourlyDemand(branchId);
  }

  @Get("product-demand")
  @ApiOperation({ summary: "7-day demand forecast for the top-selling menu items" })
  async productDemand(@Query("branchId") branchId?: string) {
    return this.forecastingService.productDemand(branchId);
  }

  @Get("model-runs")
  @ApiOperation({ summary: "Model registry — every forecast-generation run, versioned" })
  async modelRuns(@Query("modelKey") modelKey?: string) {
    return this.modelRegistry.listRuns(modelKey);
  }

  @Post("regenerate")
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      "Force-regenerate every forecast now, instead of waiting for the nightly job (admin-only)",
  })
  async regenerate(): Promise<{ triggered: true }> {
    await this.forecastingService.regenerateAll();
    return { triggered: true };
  }
}
