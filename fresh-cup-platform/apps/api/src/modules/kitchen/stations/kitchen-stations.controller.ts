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
import { CreateKitchenStationDto } from "./dto/create-kitchen-station.dto";
import { KitchenStationResponseDto } from "./dto/kitchen-station-response.dto";
import { ListKitchenStationsQueryDto } from "./dto/list-kitchen-stations-query.dto";
import { UpdateKitchenStationDto } from "./dto/update-kitchen-station.dto";
import { KitchenStationsService } from "./kitchen-stations.service";

@ApiTags("kitchen")
@Controller("admin/kitchen-stations")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("KitchenStation")
export class KitchenStationsController {
  constructor(private readonly stationsService: KitchenStationsService) {}

  @Get()
  @ApiOperation({ summary: "List kitchen stations (staff+)" })
  async list(@Query() query: ListKitchenStationsQueryDto) {
    const page = await this.stationsService.list(query);
    return { ...page, items: page.items.map((s) => this.stationsService.toResponse(s)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a kitchen station by id (staff+)" })
  @ApiOkResponse({ type: KitchenStationResponseDto })
  async get(@Param("id") id: string): Promise<KitchenStationResponseDto> {
    const station = await this.stationsService.findByIdOrThrow(id);
    return this.stationsService.toResponse(station);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create a kitchen station (manager/admin)" })
  @ApiOkResponse({ type: KitchenStationResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateKitchenStationDto,
  ): Promise<KitchenStationResponseDto> {
    const created = await this.stationsService.create(actor, dto);
    return this.stationsService.toResponse(created);
  }

  @Patch(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update a kitchen station (manager/admin)" })
  @ApiOkResponse({ type: KitchenStationResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateKitchenStationDto,
  ): Promise<KitchenStationResponseDto> {
    const updated = await this.stationsService.update(actor, id, dto);
    return this.stationsService.toResponse(updated);
  }

  @Delete(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a kitchen station (manager/admin, soft delete)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.stationsService.softDelete(actor, id);
  }
}
