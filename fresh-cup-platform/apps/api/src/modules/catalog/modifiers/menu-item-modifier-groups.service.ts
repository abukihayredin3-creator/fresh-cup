import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type MenuItem, type MenuItemModifierGroup } from "@prisma/client";
import { assertBranchAccess } from "../../../common/access/branch-access.util";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { PrismaService } from "../../../database/prisma.service";
import type { AttachModifierGroupDto } from "./dto/attach-modifier-group.dto";
import type { UpdateMenuItemModifierGroupDto } from "./dto/update-menu-item-modifier-group.dto";
import { ModifierGroupsService } from "./modifier-groups.service";

@Injectable()
export class MenuItemModifierGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modifierGroupsService: ModifierGroupsService,
  ) {}

  async attach(
    actor: RequestUser,
    menuItemId: string,
    dto: AttachModifierGroupDto,
  ): Promise<MenuItemModifierGroup> {
    const menuItem = await this.findMenuItemOrThrow(menuItemId);
    assertBranchAccess(actor, menuItem.branchId);
    const group = await this.modifierGroupsService.findByIdOrThrow(dto.modifierGroupId);
    if (group.branchId !== menuItem.branchId) {
      throw new ConflictException(
        "Modifier group belongs to a different branch than the menu item",
      );
    }

    try {
      return await this.prisma.menuItemModifierGroup.create({
        data: {
          menuItemId,
          modifierGroupId: dto.modifierGroupId,
          isRequired: dto.isRequired ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("This modifier group is already attached to the menu item");
      }
      throw error;
    }
  }

  async update(
    actor: RequestUser,
    menuItemId: string,
    linkId: string,
    dto: UpdateMenuItemModifierGroupDto,
  ): Promise<MenuItemModifierGroup> {
    const menuItem = await this.findMenuItemOrThrow(menuItemId);
    assertBranchAccess(actor, menuItem.branchId);
    await this.findLinkOrThrow(menuItemId, linkId);
    return this.prisma.menuItemModifierGroup.update({ where: { id: linkId }, data: dto });
  }

  async detach(actor: RequestUser, menuItemId: string, linkId: string): Promise<void> {
    const menuItem = await this.findMenuItemOrThrow(menuItemId);
    assertBranchAccess(actor, menuItem.branchId);
    await this.findLinkOrThrow(menuItemId, linkId);
    await this.prisma.menuItemModifierGroup.delete({ where: { id: linkId } });
  }

  private async findMenuItemOrThrow(menuItemId: string): Promise<MenuItem> {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new NotFoundException("Menu item not found");
    }
    return menuItem;
  }

  private async findLinkOrThrow(
    menuItemId: string,
    linkId: string,
  ): Promise<MenuItemModifierGroup> {
    const link = await this.prisma.menuItemModifierGroup.findUnique({ where: { id: linkId } });
    if (!link || link.menuItemId !== menuItemId) {
      throw new NotFoundException("Modifier group is not attached to this menu item");
    }
    return link;
  }
}
