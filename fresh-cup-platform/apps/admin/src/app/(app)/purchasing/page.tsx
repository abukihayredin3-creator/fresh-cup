"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, DataTable, Dialog, Select, useToast } from "@fresh-cup/ui";
import type { BadgeProps } from "@fresh-cup/ui";
import type { PurchaseOrderStatus } from "@fresh-cup/types";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useCreatePurchaseOrder, usePurchaseOrders, useSuppliers } from "@/lib/use-purchasing";
import { useInventoryItems } from "@/lib/use-inventory";

const STATUS_TONE: Record<PurchaseOrderStatus, NonNullable<BadgeProps["tone"]>> = {
  DRAFT: "neutral",
  SUBMITTED: "orange",
  RECEIVED: "green",
  CANCELLED: "error",
};

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

interface DraftLine {
  inventoryItemId: string;
  quantityOrdered: string;
  unitCost: string;
}

export default function PurchasingPage() {
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus | "">("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = usePurchaseOrders({
    branchId: branchId || undefined,
    status: status || undefined,
  });
  const createOrder = useCreatePurchaseOrder();
  const { show: showToast } = useToast();

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const [open, setOpen] = useState(false);
  const [newBranchId, setNewBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { inventoryItemId: "", quantityOrdered: "1", unitCost: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const { data: suppliers } = useSuppliers({ branchId: newBranchId || undefined });
  const { data: inventoryItems } = useInventoryItems({ branchId: newBranchId || undefined });

  function resetForm() {
    setNewBranchId("");
    setSupplierId("");
    setLines([{ inventoryItemId: "", quantityOrdered: "1", unitCost: "" }]);
    setError(null);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { inventoryItemId: "", quantityOrdered: "1", unitCost: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createOrder.mutateAsync({
        branchId: newBranchId,
        supplierId,
        lines: lines
          .filter((line) => line.inventoryItemId)
          .map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantityOrdered: Number(line.quantityOrdered),
            unitCost: Math.round(Number(line.unitCost) * 100),
          })),
      });
      showToast({ title: "Purchase order created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the purchase order. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Purchasing</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/purchasing/suppliers"
            className="text-body-sm text-accent-text hover:underline"
          >
            Suppliers
          </Link>
          <Button onClick={() => setOpen(true)}>New Purchase Order</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          label="Filter by branch"
          hideLabel
          placeholder="All branches"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          className="w-56"
        />
        <Select
          label="Filter by status"
          hideLabel
          placeholder="All statuses"
          value={status}
          onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus | "")}
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "SUBMITTED", label: "Submitted" },
            { value: "RECEIVED", label: "Received" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          className="w-56"
        />
      </div>

      <DataTable
        caption="Purchase orders"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No purchase orders found"
        columns={[
          {
            key: "id",
            header: "Order",
            render: (row) => (
              <Link href={`/purchasing/${row.id}`} className="text-accent-text hover:underline">
                {row.id.slice(0, 8)}
              </Link>
            ),
          },
          { key: "branch", header: "Branch", render: (row) => branchById.get(row.branchId) ?? "—" },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
          },
          { key: "lines", header: "Lines", render: (row) => row.lines.length },
          { key: "paid", header: "Paid", render: (row) => money(row.totalPaid) },
        ]}
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="New purchase order"
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
          <Select
            label="Branch"
            placeholder="Select a branch"
            value={newBranchId}
            onChange={(e) => {
              setNewBranchId(e.target.value);
              setSupplierId("");
            }}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <Select
            label="Supplier"
            placeholder="Select a supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={(suppliers?.items ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
          <div className="flex flex-col gap-3">
            <p className="text-body-sm font-medium text-fg">Order lines</p>
            {lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <Select
                  label="Item"
                  hideLabel
                  placeholder="Select an item"
                  value={line.inventoryItemId}
                  onChange={(e) => updateLine(index, { inventoryItemId: e.target.value })}
                  options={(inventoryItems?.items ?? []).map((i) => ({
                    value: i.id,
                    label: i.name,
                  }))}
                  className="min-w-40"
                />
                <input
                  type="number"
                  min={1}
                  value={line.quantityOrdered}
                  onChange={(e) => updateLine(index, { quantityOrdered: e.target.value })}
                  placeholder="Qty"
                  className="w-20 rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitCost}
                  onChange={(e) => updateLine(index, { unitCost: e.target.value })}
                  placeholder="Unit cost"
                  className="w-28 rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg"
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="text-caption text-danger-text underline-offset-2 hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="self-start text-caption text-accent-text underline-offset-2 hover:underline"
            >
              + Add line
            </button>
          </div>
          <Button
            type="submit"
            loading={createOrder.isPending}
            disabled={!newBranchId || !supplierId || !lines.some((l) => l.inventoryItemId)}
          >
            Create order
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
