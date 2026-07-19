"use client";

import { Badge, DataTable, Select } from "@fresh-cup/ui";
import Link from "next/link";
import { useState } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { usePredictedShortages } from "@/lib/use-inventory";

export default function PredictedShortagesPage() {
  const [branchId, setBranchId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = usePredictedShortages(branchId || undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Predicted Shortages</h1>
        <Link href="/inventory" className="text-body-sm text-accent-text hover:underline">
          Back to inventory
        </Link>
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
        caption="Predicted shortages"
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.inventoryItemId}
        emptyTitle="No shortages projected"
        columns={[
          { key: "name", header: "Item", render: (row) => row.name },
          {
            key: "stock",
            header: "Current stock",
            render: (row) => `${row.currentStock} ${row.unit}`,
          },
          {
            key: "threshold",
            header: "Reorder at",
            render: (row) => `${row.reorderThreshold} ${row.unit}`,
          },
          {
            key: "consumption",
            header: "Avg daily use",
            render: (row) => `${row.avgDailyConsumption.toFixed(1)} ${row.unit}`,
          },
          {
            key: "daysLeft",
            header: "Days until stockout",
            render: (row) =>
              row.daysUntilStockout === null ? (
                "—"
              ) : (
                <Badge tone={row.daysUntilStockout <= 3 ? "error" : "orange"}>
                  {row.daysUntilStockout} days
                </Badge>
              ),
          },
        ]}
      />
    </div>
  );
}
