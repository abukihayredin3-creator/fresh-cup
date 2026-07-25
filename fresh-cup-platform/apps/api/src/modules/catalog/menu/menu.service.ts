import { Injectable, NotFoundException } from "@nestjs/common";
import { BranchesService } from "../../branches/branches.service";
import { MenuCategoriesService } from "../categories/menu-categories.service";
import type { MenuCategoryResponseDto } from "../categories/dto/menu-category-response.dto";
import { MenuItemsService } from "../menu-items/menu-items.service";
import type { MenuItemResponseDto } from "../menu-items/dto/menu-item-response.dto";
import type { MenuBrowseResponseDto } from "./dto/menu-browse-response.dto";

/** The largest page `PaginationQueryDto` allows — this endpoint isn't paginated itself. */
const MAX_ITEMS = 100;

/**
 * Flat, branch-agnostic menu browsing (`/menu`, `/menu/categories`,
 * `/menu/:id`) for callers that don't already know a branchId — the
 * existing `/branches/:branchId/menu-categories` and
 * `/branches/:branchId/menu-items` endpoints stay exactly as they are for
 * callers that do. Recomputes nothing: every query here delegates to
 * BranchesService/MenuCategoriesService/MenuItemsService, the same
 * services those branch-scoped routes already use.
 */
@Injectable()
export class MenuService {
  constructor(
    private readonly branches: BranchesService,
    private readonly categories: MenuCategoriesService,
    private readonly menuItems: MenuItemsService,
  ) {}

  async browse(branchId?: string): Promise<MenuBrowseResponseDto> {
    const resolvedBranchId = await this.resolveBranchId(branchId);
    if (!resolvedBranchId) {
      return { branchId: null, categories: [], items: [] };
    }

    const [categories, itemsPage] = await Promise.all([
      this.categories.listActiveForBranch(resolvedBranchId),
      this.menuItems.listAvailableForBranch(resolvedBranchId, { limit: MAX_ITEMS }),
    ]);

    return {
      branchId: resolvedBranchId,
      categories: categories.map((category) => this.categories.toResponse(category)),
      items: itemsPage.items.map((item) => this.menuItems.toResponse(item)),
    };
  }

  async listCategories(branchId?: string): Promise<MenuCategoryResponseDto[]> {
    const resolvedBranchId = await this.resolveBranchId(branchId);
    if (!resolvedBranchId) {
      return [];
    }
    const categories = await this.categories.listActiveForBranch(resolvedBranchId);
    return categories.map((category) => this.categories.toResponse(category));
  }

  /** Single item by id — never branch-scoped, an id already identifies exactly one item. */
  async getItem(id: string): Promise<MenuItemResponseDto> {
    const item = await this.menuItems.findByIdOrThrow(id);
    if (!item.isAvailable) {
      throw new NotFoundException("Menu item not found");
    }
    return this.menuItems.toResponse(item);
  }

  /**
   * A caller-supplied branchId is verified (404s if it doesn't exist, same
   * as `GET /branches/:id`); omitting it falls back to the platform's
   * first active branch by name — the only branch in a typical
   * single-location deployment, and a stable, deterministic pick for a
   * multi-branch one.
   */
  private async resolveBranchId(branchId?: string): Promise<string | null> {
    if (branchId) {
      const branch = await this.branches.findByIdOrThrow(branchId);
      return branch.id;
    }
    const [firstActive] = await this.branches.listActive();
    return firstActive?.id ?? null;
  }
}
