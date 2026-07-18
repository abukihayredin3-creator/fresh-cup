import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DriverLocationPingDto } from "../drivers/dto/driver-location-ping.dto";
import { UpdateDriverAvailabilityDto } from "../drivers/dto/update-driver-availability.dto";
import { DriversService } from "../drivers/drivers.service";
import { DriverUpdateDeliveryStatusDto } from "./dto/driver-update-delivery-status.dto";
import { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";
import { DeliveriesService } from "./deliveries.service";

/**
 * Driver-facing self-service endpoints (the delivery PWA / mobile driver
 * app), distinct from the staff-facing admin/deliveries dashboard: a driver
 * may only ever act on their own availability, location, and deliveries.
 */
@ApiTags("delivery")
@Controller("delivery/driver")
@Roles(UserRole.DRIVER)
@ApiBearerAuth()
export class DriverAppController {
  constructor(
    private readonly driversService: DriversService,
    private readonly deliveriesService: DeliveriesService,
  ) {}

  @Patch("availability")
  @ApiOperation({ summary: "Toggle own online/offline availability (driver)" })
  async setAvailability(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdateDriverAvailabilityDto,
  ): Promise<{ isOnline: boolean }> {
    const profile = await this.driversService.setAvailability(actor.id, dto.isOnline);
    return { isOnline: profile.isOnline };
  }

  @Post("location")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Report a GPS location ping (driver)" })
  async reportLocation(
    @CurrentUser() actor: RequestUser,
    @Body() dto: DriverLocationPingDto,
  ): Promise<void> {
    await this.deliveriesService.recordLocation(actor.id, dto.lat, dto.lng);
  }

  @Get("deliveries")
  @ApiOperation({ summary: "List own current and past deliveries (driver)" })
  async myDeliveries(@CurrentUser() actor: RequestUser, @Query() query: ListDeliveriesQueryDto) {
    const page = await this.deliveriesService.listForDriver(actor.id, query);
    return { ...page, items: page.items.map((d) => this.deliveriesService.toResponse(d)) };
  }

  @Patch("deliveries/:id/status")
  @ApiOperation({ summary: "Advance the status of an assigned delivery (driver)" })
  async updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: DriverUpdateDeliveryStatusDto,
  ) {
    const updated = await this.deliveriesService.updateStatusAsDriver(actor.id, id, dto.status);
    return this.deliveriesService.toResponse(updated);
  }
}
