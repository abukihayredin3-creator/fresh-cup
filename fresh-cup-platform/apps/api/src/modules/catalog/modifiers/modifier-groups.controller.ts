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
import { CreateModifierGroupDto } from "./dto/create-modifier-group.dto";
import { CreateModifierOptionDto } from "./dto/create-modifier-option.dto";
import { ListModifierGroupsQueryDto } from "./dto/list-modifier-groups-query.dto";
import { ModifierGroupResponseDto } from "./dto/modifier-group-response.dto";
import { UpdateModifierGroupDto } from "./dto/update-modifier-group.dto";
import { UpdateModifierOptionDto } from "./dto/update-modifier-option.dto";
import { ModifierGroupsService } from "./modifier-groups.service";

@ApiTags("catalog")
@Controller("admin/modifier-groups")
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth()
@Auditable("ModifierGroup")
export class ModifierGroupsController {
  constructor(private readonly modifierGroupsService: ModifierGroupsService) {}

  @Get()
  @ApiOperation({ summary: "List modifier groups (staff+)" })
  async list(@Query() query: ListModifierGroupsQueryDto) {
    const page = await this.modifierGroupsService.list(query);
    return { ...page, items: page.items.map((g) => this.modifierGroupsService.toResponse(g)) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a modifier group by id (staff+)" })
  @ApiOkResponse({ type: ModifierGroupResponseDto })
  async get(@Param("id") id: string): Promise<ModifierGroupResponseDto> {
    const group = await this.modifierGroupsService.findByIdOrThrow(id);
    return this.modifierGroupsService.toResponse(group);
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create a modifier group (manager/admin)" })
  @ApiOkResponse({ type: ModifierGroupResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateModifierGroupDto,
  ): Promise<ModifierGroupResponseDto> {
    const created = await this.modifierGroupsService.create(actor, dto);
    return this.modifierGroupsService.toResponse(created);
  }

  @Patch(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update a modifier group (manager/admin)" })
  @ApiOkResponse({ type: ModifierGroupResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateModifierGroupDto,
  ): Promise<ModifierGroupResponseDto> {
    const updated = await this.modifierGroupsService.update(actor, id, dto);
    return this.modifierGroupsService.toResponse(updated);
  }

  @Delete(":id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a modifier group (manager/admin, soft delete)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.modifierGroupsService.softDelete(actor, id);
  }

  @Post(":id/options")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Add an option to a modifier group (manager/admin)" })
  async addOption(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateModifierOptionDto,
  ) {
    const option = await this.modifierGroupsService.addOption(actor, id, dto);
    return this.modifierGroupsService.optionToResponse(option);
  }

  @Patch(":id/options/:optionId")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update a modifier option (manager/admin)" })
  async updateOption(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Param("optionId") optionId: string,
    @Body() dto: UpdateModifierOptionDto,
  ) {
    const option = await this.modifierGroupsService.updateOption(actor, id, optionId, dto);
    return this.modifierGroupsService.optionToResponse(option);
  }

  @Delete(":id/options/:optionId")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a modifier option (manager/admin, soft delete)" })
  async removeOption(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Param("optionId") optionId: string,
  ): Promise<void> {
    await this.modifierGroupsService.removeOption(actor, id, optionId);
  }
}
