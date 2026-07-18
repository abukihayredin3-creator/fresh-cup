import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CreateDeliveryZoneDto } from "./dto/create-delivery-zone.dto";
import { DeliveryQuoteRequestDto } from "./dto/delivery-quote-request.dto";
import { DeliveryQuoteResponseDto } from "./dto/delivery-quote-response.dto";
import { DeliveryZoneResponseDto } from "./dto/delivery-zone-response.dto";
import { ListDeliveryZonesQueryDto } from "./dto/list-delivery-zones-query.dto";
import { UpdateDeliveryZoneDto } from "./dto/update-delivery-zone.dto";
import { DeliveryZonesService } from "./delivery-zones.service";

@ApiTags("delivery")
@Controller("admin/delivery-zones")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("DeliveryZone")
export class DeliveryZonesController {
  constructor(private readonly zonesService: DeliveryZonesService) {}

  @Get()
  @ApiOperation({ summary: "List delivery zones (staff+)" })
  async list(@Query() query: ListDeliveryZonesQueryDto) {
    const page = await this.zonesService.list(query);
    return { ...page, items: page.items.map((z) => this.zonesService.toResponse(z)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a delivery zone by id (staff+)" })
  @ApiOkResponse({ type: DeliveryZoneResponseDto })
  async get(@Param("id") id: string): Promise<DeliveryZoneResponseDto> {
    const zone = await this.zonesService.findByIdOrThrow(id);
    return this.zonesService.toResponse(zone);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create a delivery zone (manager/admin)" })
  @ApiOkResponse({ type: DeliveryZoneResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateDeliveryZoneDto,
  ): Promise<DeliveryZoneResponseDto> {
    const created = await this.zonesService.create(actor, dto);
    return this.zonesService.toResponse(created);
  }

  @Patch(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update a delivery zone (manager/admin)" })
  @ApiOkResponse({ type: DeliveryZoneResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateDeliveryZoneDto,
  ): Promise<DeliveryZoneResponseDto> {
    const updated = await this.zonesService.update(actor, id, dto);
    return this.zonesService.toResponse(updated);
  }

  @Delete(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a delivery zone (manager/admin, soft delete)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.zonesService.softDelete(actor, id);
  }

  @Post("quote")
  @ApiOperation({ summary: "Quote a delivery fee/ETA for a point (staff+)" })
  @ApiOkResponse({ type: DeliveryQuoteResponseDto })
  async quote(@Body() dto: DeliveryQuoteRequestDto): Promise<DeliveryQuoteResponseDto> {
    return this.zonesService.quote(dto.branchId, dto.lat, dto.lng);
  }
}
