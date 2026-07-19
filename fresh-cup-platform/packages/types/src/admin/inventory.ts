import type { InventoryTransactionReason, InventoryUnit } from "../enums";

export interface InventoryItem {
  id: string;
  branchId: string;
  name: string;
  unit: InventoryUnit;
  currentStock: number;
  reorderThreshold: number;
  /** ETB minor units. */
  unitCost: number;
  isActive: boolean;
  isLowStock: boolean;
}

export interface CreateInventoryItemInput {
  branchId: string;
  name: string;
  unit: InventoryUnit;
  currentStock?: number;
  reorderThreshold?: number;
  unitCost: number;
}

export type UpdateInventoryItemInput = Partial<
  Omit<CreateInventoryItemInput, "branchId" | "currentStock">
> & {
  isActive?: boolean;
};

export interface AdjustStockInput {
  delta: number;
  reason: InventoryTransactionReason;
  note?: string;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  delta: number;
  reason: InventoryTransactionReason;
  note: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface WasteReportItem {
  inventoryItemId: string;
  name: string;
  unit: string;
  totalWasted: number;
  /** ETB minor units. */
  estimatedCost: number;
  transactionCount: number;
}

export interface WasteReport {
  items: WasteReportItem[];
  totalEstimatedCost: number;
}

export interface WasteReportParams {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PredictedShortage {
  inventoryItemId: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  avgDailyConsumption: number;
  daysUntilStockout: number | null;
}
