import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InventoryTransactionReason, type InventoryItem } from "@prisma/client";
import { assertBranchAccess } from "../../common/access/branch-access.util";
import {
  INVENTORY_EVENTS,
  type InventoryLowStockEvent,
} from "../../common/events/inventory-events";
import { ORDER_EVENTS, type OrderPaidEvent } from "../../common/events/order-events";
import { paginate } from "../../common/pagination/paginate";
import type { RequestUser } from "../../common/types/request-user.interface";
import { PrismaService } from "../../database/prisma.service";
import type { AdjustStockDto } from "./dto/adjust-stock.dto";
import type { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import type { InventoryItemResponseDto } from "./dto/inventory-item-response.dto";
import type { ListInventoryItemsQueryDto } from "./dto/list-inventory-items-query.dto";
import type { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Deducts recipe-mapped ingredient stock once an order is paid. Unlike
   * adjustStock (staff-initiated, rejects going negative), this allows
   * negative stock — an already-paid order can't be rolled back, so a
   * shortfall must surface as a (visible, alertable) negative balance
   * rather than a silently-skipped deduction.
   */
  @OnEvent(ORDER_EVENTS.PAID)
  async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    const note = `Order deduction: ${event.orderId}`;
    const alreadyProcessed = await this.prisma.inventoryTransaction.findFirst({
      where: { reason: InventoryTransactionReason.ORDER_DEDUCTION, note },
    });
    if (alreadyProcessed) {
      return;
    }

    const items = await this.prisma.orderItem.findMany({ where: { orderId: event.orderId } });
    if (items.length === 0) {
      return;
    }

    const recipes = await this.prisma.recipeIngredient.findMany({
      where: { menuItemId: { in: items.map((item) => item.menuItemId) } },
    });
    if (recipes.length === 0) {
      return;
    }

    const deltaByInventoryItem = new Map<string, number>();
    for (const item of items) {
      for (const recipe of recipes.filter((r) => r.menuItemId === item.menuItemId)) {
        const delta = -(Number(recipe.quantityPerUnit) * item.quantity);
        deltaByInventoryItem.set(
          recipe.inventoryItemId,
          (deltaByInventoryItem.get(recipe.inventoryItemId) ?? 0) + delta,
        );
      }
    }

    await this.prisma.$transaction(
      Array.from(deltaByInventoryItem.entries()).flatMap(([inventoryItemId, delta]) => [
        this.prisma.inventoryTransaction.create({
          data: {
            inventoryItemId,
            delta,
            reason: InventoryTransactionReason.ORDER_DEDUCTION,
            note,
          },
        }),
        this.prisma.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { currentStock: { increment: delta } },
        }),
      ]),
    );

    this.logger.log(
      `Deducted stock for order ${event.orderId} across ${deltaByInventoryItem.size} inventory item(s)`,
    );

    for (const inventoryItemId of deltaByInventoryItem.keys()) {
      const item = await this.prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (item) {
        await this.checkLowStock(item);
      }
    }
  }

  list(query: ListInventoryItemsQueryDto) {
    return paginate<InventoryItem>(
      (page) =>
        this.prisma.inventoryItem.findMany({
          where: { branchId: query.branchId },
          orderBy: { name: "asc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async findByIdOrThrow(id: string): Promise<InventoryItem> {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Inventory item not found");
    }
    return item;
  }

  create(actor: RequestUser, dto: CreateInventoryItemDto): Promise<InventoryItem> {
    assertBranchAccess(actor, dto.branchId);
    return this.prisma.inventoryItem.create({ data: dto });
  }

  async update(
    actor: RequestUser,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItem> {
    const item = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, item.branchId);
    return this.prisma.inventoryItem.update({ where: { id }, data: dto });
  }

  /** Every stock change is recorded in the append-only ledger before the cached total is updated. */
  async adjustStock(actor: RequestUser, id: string, dto: AdjustStockDto): Promise<InventoryItem> {
    const item = await this.findByIdOrThrow(id);
    assertBranchAccess(actor, item.branchId);

    const resultingStock = Number(item.currentStock) + dto.delta;
    if (resultingStock < 0) {
      throw new BadRequestException(
        `This adjustment would leave ${item.name} at a negative stock level`,
      );
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          delta: dto.delta,
          reason: dto.reason,
          note: dto.note,
          actorUserId: actor.id,
        },
      }),
      this.prisma.inventoryItem.update({
        where: { id },
        data: { currentStock: resultingStock },
      }),
    ]);

    await this.checkLowStock(updated);
    return updated;
  }

  /**
   * Items at or below their reorder threshold, for the restock dashboard.
   * Prisma has no fluent way to compare two columns of the same row, so
   * this filters in application code — fine at the scale of one branch's
   * item catalog, and consistent with the on-demand-aggregate approach used
   * for analytics elsewhere rather than adding raw SQL for a single query.
   */
  async lowStock(query: ListInventoryItemsQueryDto): Promise<InventoryItem[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { branchId: query.branchId, isActive: true },
      orderBy: { name: "asc" },
    });
    return items.filter((item) => Number(item.currentStock) <= Number(item.reorderThreshold));
  }

  private async checkLowStock(item: InventoryItem): Promise<void> {
    const currentStock = Number(item.currentStock);
    const reorderThreshold = Number(item.reorderThreshold);
    if (currentStock > reorderThreshold) {
      return;
    }
    await this.eventEmitter.emitAsync(INVENTORY_EVENTS.LOW_STOCK, {
      inventoryItemId: item.id,
      branchId: item.branchId,
      name: item.name,
      currentStock,
      reorderThreshold,
    } satisfies InventoryLowStockEvent);
  }

  toResponse(item: InventoryItem): InventoryItemResponseDto {
    const currentStock = Number(item.currentStock);
    const reorderThreshold = Number(item.reorderThreshold);
    return {
      id: item.id,
      branchId: item.branchId,
      name: item.name,
      unit: item.unit,
      currentStock,
      reorderThreshold,
      unitCost: item.unitCost,
      isActive: item.isActive,
      isLowStock: currentStock <= reorderThreshold,
    };
  }
}
