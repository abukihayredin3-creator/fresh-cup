"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import type { InventoryUnit } from "@fresh-cup/types";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useCreateInventoryItem, useInventoryItems } from "@/lib/use-inventory";

const UNIT_LABELS: Record<InventoryUnit, string> = {
  GRAM: "g",
  MILLILITER: "mL",
  UNIT: "unit",
};

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function InventoryPage() {
  const [branchId, setBranchId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useInventoryItems({ branchId: branchId || undefined });
  const createItem = useCreateInventoryItem();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<InventoryUnit>("UNIT");
  const [reorderThreshold, setReorderThreshold] = useState("0");
  const [unitCost, setUnitCost] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setUnit("UNIT");
    setReorderThreshold("0");
    setUnitCost("");
    setNewBranchId("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createItem.mutateAsync({
        branchId: newBranchId,
        name,
        unit,
        reorderThreshold: Number(reorderThreshold),
        unitCost: Math.round(Number(unitCost) * 100),
      });
      showToast({ title: "Inventory item created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the inventory item. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Inventory</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/inventory/shortages"
            className="text-body-sm text-accent-text hover:underline"
          >
            Predicted Shortages
          </Link>
          <Link
            href="/inventory/waste-report"
            className="text-body-sm text-accent-text hover:underline"
          >
            Waste Report
          </Link>
          <Button onClick={() => setOpen(true)}>New Item</Button>
        </div>
      </div>

      <Select
        label="Filter by branch"
        hideLabel
        placeholder="All branches"
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
        className="w-56"
      />

      <DataTable
        caption="Inventory items"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No inventory items found"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/inventory/${row.id}`} className="text-accent-text hover:underline">
                {row.name}
              </Link>
            ),
          },
          {
            key: "stock",
            header: "Stock",
            render: (row) => `${row.currentStock} ${UNIT_LABELS[row.unit]}`,
          },
          {
            key: "threshold",
            header: "Reorder at",
            render: (row) => `${row.reorderThreshold} ${UNIT_LABELS[row.unit]}`,
          },
          { key: "cost", header: "Unit cost", render: (row) => money(row.unitCost) },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <div className="flex flex-wrap gap-1">
                {row.isLowStock ? <Badge tone="error">Low stock</Badge> : null}
                <Badge tone={row.isActive ? "green" : "neutral"}>
                  {row.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="New inventory item"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {error ? (
            <p
              role="alert"
              className="rounded border border-error-600 bg-error-600/15 px-3 py-2 text-body-sm text-fg"
            >
              {error}
            </p>
          ) : null}
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select
            label="Branch"
            placeholder="Select a branch"
            value={newBranchId}
            onChange={(e) => setNewBranchId(e.target.value)}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
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
            required
          />
          <Button
            type="submit"
            loading={createItem.isPending}
            disabled={!name.trim() || !unitCost || !newBranchId}
          >
            Create item
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
