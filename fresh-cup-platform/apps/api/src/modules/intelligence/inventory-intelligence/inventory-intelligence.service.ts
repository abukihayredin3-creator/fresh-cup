import { Injectable } from "@nestjs/common";
import { InventoryTransactionReason } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import type { InventoryIntelligenceItemDto } from "./dto/inventory-intelligence-item.dto";

/** Same trailing window InventoryService.predictedShortages uses, so the two stay comparable. */
const CONSUMPTION_WINDOW_DAYS = 14;
/** How many days of stock a reorder suggestion aims to cover. */
const REORDER_COVER_DAYS = 14;

/**
 * Extends InventoryService.predictedShortages (Phase 3) with waste
 * probability, expiry risk, and a concrete reorder suggestion — all
 * computed on demand from the same InventoryTransaction ledger, no new
 * persisted model beyond the `shelfLifeDays` column added to InventoryItem.
 */
@Injectable()
export class InventoryIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async intelligence(branchId?: string): Promise<InventoryIntelligenceItemDto[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { branchId, isActive: true },
    });
    if (items.length === 0) return [];

    const windowStart = new Date(Date.now() - CONSUMPTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        inventoryItemId: { in: items.map((item) => item.id) },
        createdAt: { gte: windowStart },
      },
    });

    const consumedByItem = new Map<string, number>();
    const wastedByItem = new Map<string, number>();
    for (const tx of transactions) {
      const amount = Math.abs(Number(tx.delta));
      if (tx.reason === InventoryTransactionReason.ORDER_DEDUCTION) {
        consumedByItem.set(
          tx.inventoryItemId,
          (consumedByItem.get(tx.inventoryItemId) ?? 0) + amount,
        );
      } else if (tx.reason === InventoryTransactionReason.WASTE) {
        wastedByItem.set(tx.inventoryItemId, (wastedByItem.get(tx.inventoryItemId) ?? 0) + amount);
      }
    }

    return items
      .map((item) => {
        const currentStock = Number(item.currentStock);
        const reorderThreshold = Number(item.reorderThreshold);
        const consumed = consumedByItem.get(item.id) ?? 0;
        const wasted = wastedByItem.get(item.id) ?? 0;
        const avgDailyConsumption = consumed / CONSUMPTION_WINDOW_DAYS;
        const daysUntilStockout =
          avgDailyConsumption > 0 ? currentStock / avgDailyConsumption : null;

        // Waste as a fraction of everything that left the shelf (consumed + wasted) — a stable, bounded ratio
        // even when restocking is lumpy.
        const totalOutflow = consumed + wasted;
        const wasteProbability =
          totalOutflow > 0 ? Math.round(Math.min(1, wasted / totalOutflow) * 1000) / 1000 : 0;

        const daysOfSupply = avgDailyConsumption > 0 ? currentStock / avgDailyConsumption : null;
        const expiryRisk =
          item.shelfLifeDays && daysOfSupply !== null
            ? Math.round(
                Math.min(1, Math.max(0, (daysOfSupply - item.shelfLifeDays) / item.shelfLifeDays)) *
                  1000,
              ) / 1000
            : null;

        const targetStock = avgDailyConsumption * REORDER_COVER_DAYS;
        const suggestedReorderQuantity =
          currentStock <= reorderThreshold || (daysUntilStockout !== null && daysUntilStockout <= 3)
            ? Math.max(0, Math.round((targetStock - currentStock) * 100) / 100)
            : 0;

        return {
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          currentStock,
          reorderThreshold,
          avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
          daysUntilStockout:
            daysUntilStockout !== null ? Math.round(daysUntilStockout * 10) / 10 : null,
          wasteProbability,
          expiryRisk,
          suggestedReorderQuantity,
          suggestedReorderCost: Math.round(suggestedReorderQuantity * item.unitCost),
        };
      })
      .filter(
        (row) =>
          row.suggestedReorderQuantity > 0 ||
          row.wasteProbability > 0.1 ||
          (row.expiryRisk ?? 0) > 0.1 ||
          row.currentStock <= row.reorderThreshold,
      )
      .sort((a, b) => (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity));
  }
}
