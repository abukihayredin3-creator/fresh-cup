import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { RequestUser } from "../../common/types/request-user.interface";
import { AnalyticsService } from "./analytics.service";
import { CustomerAnalyticsResponseDto } from "./dto/customer-analytics-response.dto";
import { CustomerDetailResponseDto } from "./dto/customer-detail-response.dto";
import { DashboardResponseDto } from "./dto/dashboard-response.dto";
import { DateRangeQueryDto } from "./dto/date-range-query.dto";
import { DeliveryAnalyticsResponseDto } from "./dto/delivery-analytics-response.dto";
import { DeliveryHeatmapResponseDto } from "./dto/delivery-heatmap-response.dto";
import { ItemAnalyticsResponseDto } from "./dto/item-analytics-response.dto";
import { KitchenAnalyticsResponseDto } from "./dto/kitchen-analytics-response.dto";
import { SalesAnalyticsResponseDto } from "./dto/sales-analytics-response.dto";
import { TopListQueryDto } from "./dto/top-list-query.dto";

@ApiTags("analytics")
@Controller("admin")
@Roles(UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "KPI summary for the admin dashboard (manager/admin)" })
  @ApiOkResponse({ type: DashboardResponseDto })
  async dashboard(
    @CurrentUser() actor: RequestUser,
    @Query("branchId") branchId?: string,
  ): Promise<DashboardResponseDto> {
    return this.analyticsService.dashboard(actor, branchId);
  }

  @Get("analytics/sales")
  @ApiOperation({ summary: "Revenue and order volume by day over a date range (manager/admin)" })
  @ApiOkResponse({ type: SalesAnalyticsResponseDto })
  async sales(
    @CurrentUser() actor: RequestUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<SalesAnalyticsResponseDto> {
    return this.analyticsService.sales(actor, query);
  }

  @Get("analytics/items")
  @ApiOperation({ summary: "Top-selling menu items over a date range (manager/admin)" })
  @ApiOkResponse({ type: ItemAnalyticsResponseDto })
  async items(
    @CurrentUser() actor: RequestUser,
    @Query() query: TopListQueryDto,
  ): Promise<ItemAnalyticsResponseDto> {
    return this.analyticsService.items(actor, query);
  }

  @Get("analytics/customers")
  @ApiOperation({ summary: "Top customers by spend over a date range (manager/admin)" })
  @ApiOkResponse({ type: CustomerAnalyticsResponseDto })
  async customers(
    @CurrentUser() actor: RequestUser,
    @Query() query: TopListQueryDto,
  ): Promise<CustomerAnalyticsResponseDto> {
    return this.analyticsService.customers(actor, query);
  }

  @Get("analytics/kitchen")
  @ApiOperation({
    summary: "Kitchen prep-time performance by station over a date range (manager/admin)",
  })
  @ApiOkResponse({ type: KitchenAnalyticsResponseDto })
  async kitchen(
    @CurrentUser() actor: RequestUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<KitchenAnalyticsResponseDto> {
    return this.analyticsService.kitchenPerformance(actor, query);
  }

  @Get("analytics/delivery")
  @ApiOperation({ summary: "Delivery time and zone performance over a date range (manager/admin)" })
  @ApiOkResponse({ type: DeliveryAnalyticsResponseDto })
  async delivery(
    @CurrentUser() actor: RequestUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<DeliveryAnalyticsResponseDto> {
    return this.analyticsService.deliveryPerformance(actor, query);
  }

  @Get("analytics/delivery/heatmap")
  @ApiOperation({ summary: "Delivered-order coordinates for a heat-map view (manager/admin)" })
  @ApiOkResponse({ type: DeliveryHeatmapResponseDto })
  async deliveryHeatmap(
    @CurrentUser() actor: RequestUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<DeliveryHeatmapResponseDto> {
    return this.analyticsService.deliveryHeatmap(actor, query);
  }

  @Get("customers/:id")
  @ApiOperation({
    summary: "Customer 360: profile, order history summary, loyalty (manager/admin)",
  })
  @ApiOkResponse({ type: CustomerDetailResponseDto })
  async customerDetail(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
  ): Promise<CustomerDetailResponseDto> {
    return this.analyticsService.customerDetail(actor, id);
  }
}
