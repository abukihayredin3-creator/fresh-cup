import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CreateDriverDto } from "./dto/create-driver.dto";
import { DriverResponseDto } from "./dto/driver-response.dto";
import { ListDriversQueryDto } from "./dto/list-drivers-query.dto";
import { UpdateDriverDto } from "./dto/update-driver.dto";
import { DriversService } from "./drivers.service";

@ApiTags("delivery")
@Controller("admin/drivers")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("Driver")
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  @ApiOperation({ summary: "List drivers (staff+, branch-scoped for managers)" })
  async list(@CurrentUser() actor: RequestUser, @Query() query: ListDriversQueryDto) {
    const page = await this.driversService.list(actor, query);
    return { ...page, items: page.items.map((d) => this.driversService.toResponse(d)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a driver by id (staff+)" })
  @ApiOkResponse({ type: DriverResponseDto })
  async get(@Param("id") id: string): Promise<DriverResponseDto> {
    const driver = await this.driversService.findByIdOrThrow(id);
    return this.driversService.toResponse(driver);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create a driver account (manager/admin)" })
  @ApiOkResponse({ type: DriverResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    const created = await this.driversService.create(actor, dto);
    return this.driversService.toResponse(created);
  }

  @Patch(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update a driver (manager/admin)" })
  @ApiOkResponse({ type: DriverResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    const updated = await this.driversService.update(actor, id, dto);
    return this.driversService.toResponse(updated);
  }
}
