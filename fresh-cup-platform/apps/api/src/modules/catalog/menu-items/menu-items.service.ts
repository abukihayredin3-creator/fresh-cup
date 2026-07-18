import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type MenuItem, type MenuItemImage } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import { paginate } from "../../../common/pagination/paginate";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { AdminListMenuItemsQueryDto } from "./dto/admin-list-menu-items-query.dto";
import type { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import type { ListMenuItemsQueryDto } from "./dto/list-menu-items-query.dto";
import type { MenuItemResponseDto } from "./dto/menu-item-response.dto";
import type { UpdateMenuItemDto } from "./dto/update-menu-item.dto";

type MenuItemWithImages = MenuItem & { images: MenuItemImage[] };

const WITH_IMAGES = { images: { orderBy: { sortOrder: Prisma.SortOrder.asc } } } as const;

@Injectable()
export class MenuItemsService {
  constructor(private readonly prisma: PrismaService) {}

  listAvailableForBranch(branchId: string, query: ListMenuItemsQueryDto) {
    return paginate<MenuItemWithImages>(
      (page) =>
        this.prisma.menuItem.findMany({
          where: { branchId, isAvailable: true, categoryId: query.categoryId },
          orderBy: { sortOrder: "asc" },
          include: WITH_IMAGES,
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  list(query: AdminListMenuItemsQueryDto) {
    return paginate<MenuItemWithImages>(
      (page) =>
        this.prisma.menuItem.findMany({
          where: {
            branchId: query.branchId,
            categoryId: query.categoryId,
            isAvailable: query.isAvailable,
          },
          orderBy: { sortOrder: "asc" },
          include: WITH_IMAGES,
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<MenuItemWithImages> {
    const item = await this.prisma.menuItem.findUnique({ where: { id }, include: WITH_IMAGES });
    if (!item) {
      throw new NotFoundException("Menu item not found");
    }
    return item;
  }

  create(actor: RequestUser, dto: CreateMenuItemDto): Promise<MenuItemWithImages> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.menuItem.create({ data: dto, include: WITH_IMAGES });
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItemWithImages> {
    const item = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, item.branchId);
    return this.prisma.menuItem.update({ where: { id }, data: dto, include: WITH_IMAGES });
  }

  async setAvailability(
    actor: RequestUser,
    id: string,
    isAvailable: boolean,
  ): Promise<MenuItemWithImages> {
    const item = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, item.branchId);
    return this.prisma.menuItem.update({
      where: { id },
      data: { isAvailable },
      include: WITH_IMAGES,
    });
  }

  /** Soft delete via availability — menu items stay referenceable (e.g. by future order history). */
  async softDelete(actor: RequestUser, id: string): Promise<void> {
    const item = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, item.branchId);
    await this.prisma.menuItem.update({ where: { id }, data: { isAvailable: false } });
  }

  toResponse(item: MenuItemWithImages): MenuItemResponseDto {
    return {
      id: item.id,
      branchId: item.branchId,
      categoryId: item.categoryId,
      nameEn: item.nameEn,
      nameAm: item.nameAm,
      descriptionEn: item.descriptionEn,
      descriptionAm: item.descriptionAm,
      basePrice: item.basePrice,
      isAvailable: item.isAvailable,
      calories: item.calories,
      tags: item.tags,
      sortOrder: item.sortOrder,
      images: item.images.map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
      })),
    };
  }
}
