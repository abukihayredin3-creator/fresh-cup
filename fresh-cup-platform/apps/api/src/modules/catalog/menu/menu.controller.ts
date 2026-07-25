import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../../common/decorators/public.decorator";
import { MenuBrowseQueryDto } from "./dto/menu-browse-query.dto";
import { MenuBrowseResponseDto } from "./dto/menu-browse-response.dto";
import { MenuCategoryResponseDto } from "../categories/dto/menu-category-response.dto";
import { MenuItemResponseDto } from "../menu-items/dto/menu-item-response.dto";
import { MenuService } from "./menu.service";

/**
 * Flat, branch-agnostic menu browsing — `GET /menu`, `/menu/categories`,
 * `/menu/:id`. Every existing branch-scoped route
 * (`/branches/:branchId/menu-categories`, `/branches/:branchId/menu-items`,
 * `/menu-items/:id`, all in MenuCategoriesController/MenuItemsController)
 * is untouched; this controller is purely additive, for callers that
 * don't already know a branchId. All public — no auth required.
 *
 * Route order matters here: the static `categories` path is declared
 * before the dynamic `:id` path so `GET /menu/categories` doesn't get
 * swallowed by `GET /menu/:id` with id="categories".
 */
@ApiTags("catalog")
@Controller("menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Browse the menu: categories + available items (public)" })
  @ApiOkResponse({ type: MenuBrowseResponseDto })
  browse(@Query() query: MenuBrowseQueryDto): Promise<MenuBrowseResponseDto> {
    return this.menuService.browse(query.branchId);
  }

  @Public()
  @Get("categories")
  @ApiOperation({ summary: "List menu categories (public)" })
  @ApiOkResponse({ type: MenuCategoryResponseDto, isArray: true })
  listCategories(@Query() query: MenuBrowseQueryDto): Promise<MenuCategoryResponseDto[]> {
    return this.menuService.listCategories(query.branchId);
  }

  @Public()
  @Get(":id")
  @ApiOperation({ summary: "Get a single available menu item by id (public)" })
  @ApiOkResponse({ type: MenuItemResponseDto })
  getItem(@Param("id") id: string): Promise<MenuItemResponseDto> {
    return this.menuService.getItem(id);
  }
}
