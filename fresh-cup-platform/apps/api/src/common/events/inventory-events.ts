export const INVENTORY_EVENTS = {
  LOW_STOCK: "inventory.low_stock",
} as const;

export interface InventoryLowStockEvent {
  inventoryItemId: string;
  branchId: string;
  name: string;
  currentStock: number;
  reorderThreshold: number;
}
