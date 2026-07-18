import { Injectable, NotFoundException } from "@nestjs/common";
import type { MenuCategory } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateMenuCategoryDto } from "./dto/create-menu-category.dto";
import type { ListMenuCategoriesQueryDto } from "./dto/list-menu-categories-query.dto";
import type { MenuCategoryResponseDto } from "./dto/menu-category-response.dto";
import type { UpdateMenuCategoryDto } from "./dto/update-menu-category.dto";

@Injectable()
export class MenuCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  listActiveForBranch(branchId: string): Promise<MenuCategory[]> {
    return this.prisma.menuCategory.findMany({
      where: { branchId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  list(query: ListMenuCategoriesQueryDto) {
    return paginate<MenuCategory>(
      (page) =>
        this.prisma.menuCategory.findMany({
          where: query.branchId ? { branchId: query.branchId } : {},
          orderBy: { sortOrder: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<MenuCategory> {
    const category = await this.prisma.menuCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException("Menu category not found");
    }
    return category;
  }

  create(actor: RequestUser, dto: CreateMenuCategoryDto): Promise<MenuCategory> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.menuCategory.create({ data: dto });
  }

  async update(actor: RequestUser, id: string, dto: UpdateMenuCategoryDto): Promise<MenuCategory> {
    const category = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, category.branchId);
    return this.prisma.menuCategory.update({ where: { id }, data: dto });
  }

  /** Soft delete — hard-deleting would orphan any menu items still pointing at this category. */
  async softDelete(actor: RequestUser, id: string): Promise<void> {
    const category = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, category.branchId);
    await this.prisma.menuCategory.update({ where: { id }, data: { isActive: false } });
  }

  toResponse(category: MenuCategory): MenuCategoryResponseDto {
    return {
      id: category.id,
      branchId: category.branchId,
      nameEn: category.nameEn,
      nameAm: category.nameAm,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    };
  }
}
