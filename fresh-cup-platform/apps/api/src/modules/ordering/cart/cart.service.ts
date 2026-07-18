import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MenuItemsService, type MenuItemDetail } from "../../catalog/menu-items/menu-items.service";
import { PrismaService } from "../../../database/prisma.service";
import type { AddCartItemDto } from "./dto/add-cart-item.dto";
import type { CartResponseDto } from "./dto/cart-response.dto";

const WITH_ITEMS = {
  items: {
    orderBy: { createdAt: Prisma.SortOrder.asc },
    include: { menuItem: true, modifiers: { include: { modifierOption: true } } },
  },
} as const;

type CartDetail = Prisma.CartGetPayload<{ include: typeof WITH_ITEMS }>;
type CartItemDetail = CartDetail["items"][number];
type CartItemWithModifiers = Prisma.CartItemGetPayload<{ include: { modifiers: true } }>;

export interface ModifierSelection {
  modifierOptionId: string;
  nameEn: string;
  priceDelta: number;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menuItemsService: MenuItemsService,
  ) {}

  async getCart(userId: string, branchId: string): Promise<CartResponseDto> {
    const cart = await this.findCartRecord(userId, branchId);
    if (!cart) {
      return { id: null, branchId, items: [], subtotal: 0, itemCount: 0 };
    }
    return this.toResponse(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartResponseDto> {
    const menuItem = await this.menuItemsService.findByIdOrThrow(dto.menuItemId);
    if (menuItem.branchId !== dto.branchId) {
      throw new BadRequestException("Menu item does not belong to the given branch");
    }
    if (!menuItem.isAvailable) {
      throw new BadRequestException("This item is currently unavailable");
    }
    const modifierOptionIds = dto.modifierOptionIds ?? [];
    this.validateModifierSelection(menuItem, modifierOptionIds);

    const cart = await this.prisma.cart.upsert({
      where: { userId_branchId: { userId, branchId: dto.branchId } },
      create: { userId, branchId: dto.branchId },
      update: {},
    });

    const quantity = dto.quantity ?? 1;
    const existing = await this.findMatchingItem(
      cart.id,
      dto.menuItemId,
      modifierOptionIds,
      dto.notes,
    );

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: dto.menuItemId,
          quantity,
          notes: dto.notes,
          modifiers: {
            create: modifierOptionIds.map((modifierOptionId) => ({ modifierOptionId })),
          },
        },
      });
    }

    return this.getCart(userId, dto.branchId);
  }

  async updateItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartResponseDto> {
    const item = await this.findItemOrThrow(userId, itemId);
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.getCart(userId, item.cart.branchId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponseDto> {
    const item = await this.findItemOrThrow(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId, item.cart.branchId);
  }

  async clearCart(userId: string, branchId: string): Promise<void> {
    // Cascade deletes items/modifiers with the cart row.
    await this.prisma.cart.deleteMany({ where: { userId, branchId } });
  }

  /**
   * Validates that every selected option belongs to a group actually
   * attached to this item, and that each group's selection count is
   * within [effectiveMin, maxSelect]. Reused by checkout, which re-runs
   * this against the live catalog rather than trusting the cart's
   * contents at add-time (an option may have been discontinued since).
   */
  validateModifierSelection(
    menuItem: MenuItemDetail,
    modifierOptionIds: string[],
  ): ModifierSelection[] {
    const optionToGroup = new Map<
      string,
      {
        link: MenuItemDetail["modifierGroupLinks"][number];
        option: { nameEn: string; priceDelta: number };
      }
    >();
    for (const link of menuItem.modifierGroupLinks) {
      for (const option of link.modifierGroup.options) {
        optionToGroup.set(option.id, { link, option });
      }
    }

    const selections: ModifierSelection[] = [];
    const countByGroup = new Map<string, number>();

    for (const optionId of modifierOptionIds) {
      const match = optionToGroup.get(optionId);
      if (!match) {
        throw new BadRequestException(`Modifier option ${optionId} is not available for this item`);
      }
      selections.push({
        modifierOptionId: optionId,
        nameEn: match.option.nameEn,
        priceDelta: match.option.priceDelta,
      });
      const groupId = match.link.modifierGroupId;
      countByGroup.set(groupId, (countByGroup.get(groupId) ?? 0) + 1);
    }

    for (const link of menuItem.modifierGroupLinks) {
      const count = countByGroup.get(link.modifierGroupId) ?? 0;
      const effectiveMin = link.isRequired
        ? Math.max(link.modifierGroup.minSelect, 1)
        : link.modifierGroup.minSelect;
      const effectiveMax = link.modifierGroup.maxSelect;

      if (count < effectiveMin) {
        throw new BadRequestException(
          `"${link.modifierGroup.nameEn}" requires at least ${effectiveMin} selection(s)`,
        );
      }
      if (effectiveMax !== null && count > effectiveMax) {
        throw new BadRequestException(
          `"${link.modifierGroup.nameEn}" allows at most ${effectiveMax} selection(s)`,
        );
      }
    }

    return selections;
  }

  private async findCartRecord(userId: string, branchId: string): Promise<CartDetail | null> {
    return this.prisma.cart.findUnique({
      where: { userId_branchId: { userId, branchId } },
      include: WITH_ITEMS,
    });
  }

  private async findItemOrThrow(
    userId: string,
    itemId: string,
  ): Promise<Prisma.CartItemGetPayload<{ include: { cart: true } }>> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException("Cart item not found");
    }
    return item;
  }

  private async findMatchingItem(
    cartId: string,
    menuItemId: string,
    modifierOptionIds: string[],
    notes: string | undefined,
  ): Promise<CartItemWithModifiers | undefined> {
    const candidates = await this.prisma.cartItem.findMany({
      where: { cartId, menuItemId },
      include: { modifiers: true },
    });

    const normalizedNotes = notes?.trim() || null;
    const sortedIds = [...modifierOptionIds].sort();

    return candidates.find((candidate) => {
      if ((candidate.notes?.trim() || null) !== normalizedNotes) {
        return false;
      }
      const candidateIds = candidate.modifiers.map((m) => m.modifierOptionId).sort();
      return (
        candidateIds.length === sortedIds.length &&
        candidateIds.every((id, index) => id === sortedIds[index])
      );
    });
  }

  private toResponse(cart: CartDetail): CartResponseDto {
    const items = cart.items.map((item) => this.itemToResponse(item));
    return {
      id: cart.id,
      branchId: cart.branchId,
      items,
      subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  private itemToResponse(item: CartItemDetail): CartResponseDto["items"][number] {
    const modifiers = item.modifiers.map((m) => ({
      modifierOptionId: m.modifierOptionId,
      nameEn: m.modifierOption.nameEn,
      priceDelta: m.modifierOption.priceDelta,
    }));
    const unitPrice = item.menuItem.basePrice + modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
    return {
      id: item.id,
      menuItemId: item.menuItemId,
      nameEn: item.menuItem.nameEn,
      quantity: item.quantity,
      notes: item.notes,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      modifiers,
    };
  }
}
