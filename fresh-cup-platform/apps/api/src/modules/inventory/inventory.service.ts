import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import {
  InventoryTransactionReason,
  type InventoryItem,
  type InventoryTransaction,
} from "@prisma/client";
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
import type { InventoryHistoryQueryDto } from "./dto/inventory-history-query.dto";
import type { InventoryItemResponseDto } from "./dto/inventory-item-response.dto";
import type { InventoryTransactionResponseDto } from "./dto/inventory-transaction-response.dto";
import type { ListInventoryItemsQueryDto } from "./dto/list-inventory-items-query.dto";
import type { PredictedShortageDto } from "./dto/predicted-shortage-response.dto";
import type { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import type { WasteReportQueryDto } from "./dto/waste-report-query.dto";
import type { WasteReportItemDto, WasteReportResponseDto } from "./dto/waste-report-response.dto";

/** Trailing window used to estimate daily consumption for the shortage predictor. */
const CONSUMPTION_WINDOW_DAYS = 14;

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

  /** Ledger history for a single item, most recent first. */
  history(itemId: string, query: InventoryHistoryQueryDto) {
    return paginate<InventoryTransaction>(
      (page) =>
        this.prisma.inventoryTransaction.findMany({
          where: { inventoryItemId: itemId, reason: query.reason },
          orderBy: { createdAt: "desc" },
          ...page,
        }),
      { cursor: query.cursor, limit: query.limit },
    );
  }

  transactionToResponse(tx: InventoryTransaction): InventoryTransactionResponseDto {
    return {
      id: tx.id,
      inventoryItemId: tx.inventoryItemId,
      delta: Number(tx.delta),
      reason: tx.reason,
      note: tx.note,
      actorUserId: tx.actorUserId,
      createdAt: tx.createdAt,
    };
  }

  /** Aggregates WASTE-reason ledger entries per item over an optional date range. */
  async wasteReport(query: WasteReportQueryDto): Promise<WasteReportResponseDto> {
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        reason: InventoryTransactionReason.WASTE,
        createdAt: {
          gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
          lte: query.dateTo ? new Date(query.dateTo) : undefined,
        },
        inventoryItem: { branchId: query.branchId },
      },
      include: { inventoryItem: true },
    });

    const byItem = new Map<string, WasteReportItemDto>();
    for (const tx of transactions) {
      const wasted = Math.abs(Number(tx.delta));
      const existing = byItem.get(tx.inventoryItemId);
      if (existing) {
        existing.totalWasted += wasted;
        existing.estimatedCost += wasted * tx.inventoryItem.unitCost;
        existing.transactionCount += 1;
      } else {
        byItem.set(tx.inventoryItemId, {
          inventoryItemId: tx.inventoryItemId,
          name: tx.inventoryItem.name,
          unit: tx.inventoryItem.unit,
          totalWasted: wasted,
          estimatedCost: wasted * tx.inventoryItem.unitCost,
          transactionCount: 1,
        });
      }
    }

    const items = Array.from(byItem.values()).sort((a, b) => b.estimatedCost - a.estimatedCost);
    return {
      items,
      totalEstimatedCost: items.reduce((sum, item) => sum + item.estimatedCost, 0),
    };
  }

  /**
   * Flags items likely to hit zero stock soon, based on average daily
   * ORDER_DEDUCTION consumption over a trailing window. Application-code
   * aggregate rather than raw SQL, consistent with lowStock()/analytics
   * elsewhere in this codebase.
   */
  async predictedShortages(branchId?: string): Promise<PredictedShortageDto[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { branchId, isActive: true },
    });
    if (items.length === 0) {
      return [];
    }

    const windowStart = new Date(Date.now() - CONSUMPTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const deductions = await this.prisma.inventoryTransaction.findMany({
      where: {
        inventoryItemId: { in: items.map((item) => item.id) },
        reason: InventoryTransactionReason.ORDER_DEDUCTION,
        createdAt: { gte: windowStart },
      },
    });

    const consumedByItem = new Map<string, number>();
    for (const tx of deductions) {
      const consumed = Math.abs(Number(tx.delta));
      consumedByItem.set(
        tx.inventoryItemId,
        (consumedByItem.get(tx.inventoryItemId) ?? 0) + consumed,
      );
    }

    return items
      .map((item) => {
        const currentStock = Number(item.currentStock);
        const reorderThreshold = Number(item.reorderThreshold);
        const avgDailyConsumption = (consumedByItem.get(item.id) ?? 0) / CONSUMPTION_WINDOW_DAYS;
        const daysUntilStockout =
          avgDailyConsumption > 0 ? currentStock / avgDailyConsumption : null;
        return {
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          currentStock,
          reorderThreshold,
          avgDailyConsumption,
          daysUntilStockout,
        };
      })
      .filter(
        (prediction) =>
          prediction.daysUntilStockout !== null ||
          prediction.currentStock <= prediction.reorderThreshold,
      )
      .sort((a, b) => (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity));
  }
}
