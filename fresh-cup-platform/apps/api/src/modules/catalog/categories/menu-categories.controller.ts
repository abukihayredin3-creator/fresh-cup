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
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { CreateMenuCategoryDto } from "./dto/create-menu-category.dto";
import { ListMenuCategoriesQueryDto } from "./dto/list-menu-categories-query.dto";
import { MenuCategoryResponseDto } from "./dto/menu-category-response.dto";
import { UpdateMenuCategoryDto } from "./dto/update-menu-category.dto";
import { MenuCategoriesService } from "./menu-categories.service";

@ApiTags("catalog")
@Controller()
export class MenuCategoriesController {
  constructor(private readonly categoriesService: MenuCategoriesService) {}

  @Public()
  @Get("branches/:branchId/menu-categories")
  @ApiOperation({ summary: "List active menu categories for a branch (public)" })
  @ApiOkResponse({ type: MenuCategoryResponseDto, isArray: true })
  async listForBranch(@Param("branchId") branchId: string): Promise<MenuCategoryResponseDto[]> {
    const categories = await this.categoriesService.listActiveForBranch(branchId);
    return categories.map((c) => this.categoriesService.toResponse(c));
  }

  @Get("admin/menu-categories")
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List all menu categories, including inactive (staff+)" })
  async list(@Query() query: ListMenuCategoriesQueryDto) {
    const page = await this.categoriesService.list(query);
    return { ...page, items: page.items.map((c) => this.categoriesService.toResponse(c)) };
  }

  @Post("admin/menu-categories")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a menu category (manager/admin)" })
  @ApiOkResponse({ type: MenuCategoryResponseDto })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateMenuCategoryDto,
  ): Promise<MenuCategoryResponseDto> {
    const created = await this.categoriesService.create(actor, dto);
    return this.categoriesService.toResponse(created);
  }

  @Patch("admin/menu-categories/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a menu category (manager/admin)" })
  @ApiOkResponse({ type: MenuCategoryResponseDto })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategoryResponseDto> {
    const updated = await this.categoriesService.update(actor, id, dto);
    return this.categoriesService.toResponse(updated);
  }

  @Delete("admin/menu-categories/:id")
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate a menu category (manager/admin, soft delete)" })
  async remove(@CurrentUser() actor: RequestUser, @Param("id") id: string): Promise<void> {
    await this.categoriesService.softDelete(actor, id);
  }
}
