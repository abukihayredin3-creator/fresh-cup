import { Injectable, NotFoundException } from "@nestjs/common";
import type { MenuItem, MenuItemImage } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { CreateMenuItemImageDto } from "./dto/create-menu-item-image.dto";
import type { MenuItemImageResponseDto } from "./dto/menu-item-image-response.dto";
import type { UpdateMenuItemImageDto } from "./dto/update-menu-item-image.dto";

@Injectable()
export class MenuItemImagesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(
    actor: RequestUser,
    menuItemId: string,
    dto: CreateMenuItemImageDto,
  ): Promise<MenuItemImage> {
    const menuItem = await this.findMenuItemOrThrow(menuItemId);
    assertBranchAccess(actor, menuItem.branchId);

    if (dto.isPrimary) {
      await this.clearExistingPrimary(menuItemId);
    }

    return this.prisma.menuItemImage.create({ data: { ...dto, menuItemId } });
  }

  async update(
    actor: RequestUser,
    menuItemId: string,
    imageId: string,
    dto: UpdateMenuItemImageDto,
  ): Promise<MenuItemImage> {
    const menuItem = await this.findMenuItemOrThrow(menuItemId);
    assertBranchAccess(actor, menuItem.branchId);
    await this.findImageOrThrow(menuItemId, imageId);

    if (dto.isPrimary) {
      await this.clearExistingPrimary(menuItemId);
    }

    return this.prisma.menuItemImage.update({ where: { id: imageId }, data: dto });
  }

  async remove(actor: RequestUser, menuItemId: string, imageId: string): Promise<void> {
    const menuItem = await this.findMenuItemOrThrow(menuItemId);
    assertBranchAccess(actor, menuItem.branchId);
    await this.findImageOrThrow(menuItemId, imageId);
    await this.prisma.menuItemImage.delete({ where: { id: imageId } });
  }

  private async findMenuItemOrThrow(menuItemId: string): Promise<MenuItem> {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }
    return menuItem;
  }

  private async findImageOrThrow(menuItemId: string, imageId: string): Promise<MenuItemImage> {
    const image = await this.prisma.menuItemImage.findUnique({ where: { id: imageId } });
    if (!image || image.menuItemId !== menuItemId) {
      throw new NotFoundException("Image not found for this menu item");
    }
    return image;
  }

  private clearExistingPrimary(menuItemId: string): Promise<unknown> {
    return this.prisma.menuItemImage.updateMany({
      where: { menuItemId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  toResponse(image: MenuItemImage): MenuItemImageResponseDto {
    return {
      id: image.id,
      url: image.url,
      altText: image.altText,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
    };
  }
}
