import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { AssignDriverDto } from "./dto/assign-driver.dto";
import { DeliveryResponseDto } from "./dto/delivery-response.dto";
import { DeliveryTrackingPingResponseDto } from "./dto/delivery-tracking-ping-response.dto";
import { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";
import { DeliveriesService } from "./deliveries.service";

@ApiTags("delivery")
@Controller("admin/deliveries")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("Delivery")
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @ApiOperation({
    summary: "Delivery dashboard: list deliveries (staff+, branch-scoped for managers)",
  })
  async list(@CurrentUser() actor: RequestUser, @Query() query: ListDeliveriesQueryDto) {
    const page = await this.deliveriesService.list(actor, query);
    return { ...page, items: page.items.map((d) => this.deliveriesService.toResponse(d)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a delivery by id (staff+)" })
  @ApiOkResponse({ type: DeliveryResponseDto })
  async get(@Param("id") id: string): Promise<DeliveryResponseDto> {
    const delivery = await this.deliveriesService.findByIdOrThrow(id);
    return this.deliveriesService.toResponse(delivery);
  }

  @Get(":id/tracking")
  @ApiOperation({ summary: "GPS tracking pings for a delivery (staff+)" })
  @ApiOkResponse({ type: DeliveryTrackingPingResponseDto, isArray: true })
  async getTracking(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
  ): Promise<DeliveryTrackingPingResponseDto[]> {
    return this.deliveriesService.getTracking(actor, id);
  }

  @Post(":id/assign")
  @ApiOperation({ summary: "Assign a driver to a delivery (staff+)" })
  @ApiOkResponse({ type: DeliveryResponseDto })
  async assign(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: AssignDriverDto,
  ): Promise<DeliveryResponseDto> {
    const updated = await this.deliveriesService.assign(actor, id, dto);
    return this.deliveriesService.toResponse(updated);
  }
}
