import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Auditable } from "../../../common/audit/auditable.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { AttachModifierGroupDto } from "../modifiers/dto/attach-modifier-group.dto";
import { UpdateMenuItemModifierGroupDto } from "../modifiers/dto/update-menu-item-modifier-group.dto";
import { MenuItemModifierGroupsService } from "../modifiers/menu-item-modifier-groups.service";
import { AdminListMenuItemsQueryDto } from "./dto/admin-list-menu-items-query.dto";
import { CreateMenuItemImageDto } from "./dto/create-menu-item-image.dto";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import { ListMenuItemsQueryDto } from "./dto/list-menu-items-query.dto";
import { MenuItemImageResponseDto } from "./dto/menu-item-image-response.dto";
import { MenuItemResponseDto } from "./dto/menu-item-response.dto";
import { UpdateAvailabilityDto } from "./dto/update-availability.dto";
import { UpdateMenuItemImageDto } from "./dto/update-menu-item-image.dto";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto";
import { MenuItemImagesService } from "./menu-item-images.service";
import { MenuItemsService } from "./menu-items.service";

@ApiTags("catalog")
@Controller()
@Auditable("MenuItem")
export class MenuItemsController {
  constructor(
    private readonly menuItemsService: MenuItemsService,
    private readonly imagesService: MenuItemImagesService,
    private readonly modifierGroupsService: MenuItemModifierGroupsService,
  ) {}

  @Public()
  @Get("branches/:branchId/menu-items")
  @ApiOperation({ summary: "List available menu items for a branch (public)" })
  async listForBranch(@Param("branchId") branchId: string, @Query() query: ListMenuItemsQueryDto) {
    const page = await this.menuItemsService.listAvailableForBranch(branchId, query);
    return { ...page, items: page.items.map((i) => this.menuItemsService.toResponse(i)) };
  }

  @Public()
  @Get("menu-items/:id")
  @ApiOperation({ summary: "Get an available menu item by id (public)" })
  @ApiOkResponse({ type: MenuItemResponseDto })
  async getPublic(@Param("id") id: string): Promise<MenuItemResponseDto> {
    const item = await this.menuItemsService.findByIdOrThrow(id);
    if (!item.isAvailable) {
      throw new NotFoundException("Menu item not found");
    }
    return this.menuItemsService.toResponse(item);
  }

  @Get("admin/menu-items")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List menu items, including unavailable (staff+)" })
  async list(@Query() query: AdminListMenuItemsQueryDto) {
    const page = await this.menuItemsService.list(query);
    return { ...page, items: page.items.map((i) => this.menuItemsService.toResponse(i)) };
  }

  @Get("admin/menu-items/:id")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get any menu item by id (staff+)" })
  @ApiOkResponse({ type: MenuItemResponseDto })
  async get(@Param("id") id: string): Promise<MenuItemResponseDto> {
    const item = await this.menuItemsService.findByIdOrThrow(id);
    return this.menuItemsService.toResponse(item);
  }

  @Post("admin/menu-items")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a menu item (manager/admin)" })
  @ApiOkResponse({ type: MenuItemResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    const created = await this.menuItemsService.create(actor, dto);
    return this.menuItemsService.toResponse(created);
  }

  @Patch("admin/menu-items/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a menu item (manager/admin)" })
  @ApiOkResponse({ type: MenuItemResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    const updated = await this.menuItemsService.update(actor, id, dto);
    return this.menuItemsService.toResponse(updated);
  }

  @Patch("admin/menu-items/:id/availability")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Toggle whether a menu item can currently be ordered (staff+)" })
  @ApiOkResponse({ type: MenuItemResponseDto })
  async updateAvailability(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateAvailabilityDto,
  ): Promise<MenuItemResponseDto> {
    const updated = await this.menuItemsService.setAvailability(actor, id, dto.isAvailable);
    return this.menuItemsService.toResponse(updated);
  }

  @Delete("admin/menu-items/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a menu item (manager/admin, soft delete)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.menuItemsService.softDelete(actor, id);
  }

  @Post("admin/menu-items/:id/images")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Register an image for a menu item (manager/admin)" })
  @ApiOkResponse({ type: MenuItemImageResponseDto })
  async addImage(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateMenuItemImageDto,
  ): Promise<MenuItemImageResponseDto> {
    const image = await this.imagesService.add(actor, id, dto);
    return this.imagesService.toResponse(image);
  }

  @Patch("admin/menu-items/:id/images/:imageId")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a menu item image (manager/admin)" })
  @ApiOkResponse({ type: MenuItemImageResponseDto })
  async updateImage(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Param("imageId") imageId: string,
    @Body() dto: UpdateMenuItemImageDto,
  ): Promise<MenuItemImageResponseDto> {
    const image = await this.imagesService.update(actor, id, imageId, dto);
    return this.imagesService.toResponse(image);
  }

  @Delete("admin/menu-items/:id/images/:imageId")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a menu item image (manager/admin)" })
  async removeImage(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Param("imageId") imageId: string,
  ): Promise<void> {
    await this.imagesService.remove(actor, id, imageId);
  }

  @Post("admin/menu-items/:id/modifier-groups")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Attach a modifier group to a menu item (manager/admin)" })
  async attachModifierGroup(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: AttachModifierGroupDto,
  ) {
    return this.modifierGroupsService.attach(actor, id, dto);
  }

  @Patch("admin/menu-items/:id/modifier-groups/:linkId")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an attached modifier group's isRequired/sortOrder (manager/admin)",
  })
  async updateModifierGroupLink(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Param("linkId") linkId: string,
    @Body() dto: UpdateMenuItemModifierGroupDto,
  ) {
    return this.modifierGroupsService.update(actor, id, linkId, dto);
  }

  @Delete("admin/menu-items/:id/modifier-groups/:linkId")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Detach a modifier group from a menu item (manager/admin)" })
  async detachModifierGroup(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Param("linkId") linkId: string,
  ): Promise<void> {
    await this.modifierGroupsService.detach(actor, id, linkId);
  }
}
