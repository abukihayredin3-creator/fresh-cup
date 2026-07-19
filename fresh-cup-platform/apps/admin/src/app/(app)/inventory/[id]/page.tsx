"use client";

import {
  Badge,
  Button,
  Card,
  DataTable,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@fresh-cup/ui";
import type { InventoryTransactionReason, InventoryUnit } from "@fresh-cup/types";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  useAdjustStock,
  useInventoryHistory,
  useInventoryItem,
  useUpdateInventoryItem,
} from "@/lib/use-inventory";

const UNIT_LABELS: Record<InventoryUnit, string> = {
  GRAM: "g",
  MILLILITER: "mL",
  UNIT: "unit",
};

const ADJUST_REASONS: { value: InventoryTransactionReason; label: string }[] = [
  { value: "RESTOCK", label: "Restock" },
  { value: "WASTE", label: "Waste" },
  { value: "MANUAL_ADJUSTMENT", label: "Manual adjustment" },
];

const REASON_TONE: Record<InventoryTransactionReason, "green" | "error" | "orange" | "neutral"> = {
  RESTOCK: "green",
  WASTE: "error",
  MANUAL_ADJUSTMENT: "orange",
  ORDER_DEDUCTION: "neutral",
};

function DetailsCard({ itemId }: { itemId: string }) {
  const { data: item, isLoading } = useInventoryItem(itemId);
  const updateItem = useUpdateInventoryItem(itemId);
  const { show: showToast } = useToast();

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<InventoryUnit>("UNIT");
  const [reorderThreshold, setReorderThreshold] = useState("0");
  const [unitCost, setUnitCost] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!item) return;
    // eslint-disable-next-line -- populates the edit form once the item loads
    setName(item.name);
    setUnit(item.unit);
    setReorderThreshold(String(item.reorderThreshold));
    setUnitCost((item.unitCost / 100).toFixed(2));
    setIsActive(item.isActive);
  }, [item]);

  async function handleSave() {
    try {
      await updateItem.mutateAsync({
        name,
        unit,
        reorderThreshold: Number(reorderThreshold),
        unitCost: Math.round(Number(unitCost) * 100),
        isActive,
      });
      showToast({ title: "Inventory item updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update inventory item", tone: "error" });
    }
  }

  if (isLoading || !item) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <p className="text-body font-medium text-fg">
          Current stock: {item.currentStock} {UNIT_LABELS[item.unit]}
        </p>
        {item.isLowStock ? <Badge tone="error">Low stock</Badge> : null}
      </div>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Select
        label="Unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value as InventoryUnit)}
        options={[
          { value: "UNIT", label: "Unit" },
          { value: "GRAM", label: "Gram" },
          { value: "MILLILITER", label: "Milliliter" },
        ]}
      />
      <Input
        label="Reorder threshold"
        type="number"
        min={0}
        value={reorderThreshold}
        onChange={(e) => setReorderThreshold(e.target.value)}
      />
      <Input
        label="Unit cost (ETB)"
        type="number"
        min={0}
        step="0.01"
        value={unitCost}
        onChange={(e) => setUnitCost(e.target.value)}
      />
      <label className="flex items-center gap-2 text-body-sm text-fg">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Active
      </label>
      <div>
        <Button onClick={handleSave} loading={updateItem.isPending}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

function AdjustStockCard({ itemId }: { itemId: string }) {
  const { data: item } = useInventoryItem(itemId);
  const adjustStock = useAdjustStock(itemId);
  const { show: showToast } = useToast();

  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<InventoryTransactionReason>("RESTOCK");
  const [note, setNote] = useState("");

  async function handleAdjust() {
    const parsed = Number(delta);
    if (!parsed) return;
    try {
      await adjustStock.mutateAsync({
        delta: reason === "WASTE" ? -Math.abs(parsed) : parsed,
        reason,
        note: note || undefined,
      });
      setDelta("");
      setNote("");
      showToast({ title: "Stock adjusted", tone: "success" });
    } catch {
      showToast({ title: "Could not adjust stock", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">Adjust stock</p>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label={`Quantity (${item ? UNIT_LABELS[item.unit] : "units"})`}
          type="number"
          min={0}
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="w-32"
        />
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as InventoryTransactionReason)}
          options={ADJUST_REASONS}
        />
        <Button onClick={handleAdjust} loading={adjustStock.isPending} disabled={!delta}>
          Apply
        </Button>
      </div>
      <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
    </Card>
  );
}

function HistoryCard({ itemId }: { itemId: string }) {
  const { data, isLoading } = useInventoryHistory(itemId);

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">Transaction history</p>
      <DataTable
        caption="Inventory transactions"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No transactions yet"
        columns={[
          {
            key: "delta",
            header: "Change",
            render: (row) => (row.delta > 0 ? `+${row.delta}` : row.delta),
          },
          {
            key: "reason",
            header: "Reason",
            render: (row) => <Badge tone={REASON_TONE[row.reason]}>{row.reason}</Badge>,
          },
          { key: "note", header: "Note", render: (row) => row.note ?? "—" },
          {
            key: "date",
            header: "Date",
            render: (row) =>
              new Date(row.createdAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              }),
          },
        ]}
      />
    </Card>
  );
}

export default function InventoryItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: item } = useInventoryItem(id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">{item?.name ?? "Inventory item"}</h1>
        <Link href="/inventory" className="text-body-sm text-accent-text hover:underline">
          Back to inventory
        </Link>
      </div>
      <DetailsCard itemId={id} />
      <AdjustStockCard itemId={id} />
      <HistoryCard itemId={id} />
    </div>
  );
}
