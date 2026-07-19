"use client";

import { Badge, Card, DataTable, Select } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useInventoryIntelligence } from "@/lib/use-intelligence";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

function riskTone(value: number): "green" | "orange" | "error" {
  if (value >= 0.6) return "error";
  if (value >= 0.3) return "orange";
  return "green";
}

export default function InventoryIntelligencePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  const { data, isLoading } = useInventoryIntelligence(branchId);
  const items = data?.items ?? [];
  const totalReorderCost = items.reduce((sum, item) => sum + item.suggestedReorderCost, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {isAdmin && branches && branches.length > 0 ? (
          <Select
            label="Branch"
            value={branchId ?? ""}
            onChange={(e) => setBranchId(e.target.value || undefined)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="All branches"
            className="w-56"
          />
        ) : null}
        {items.length > 0 ? (
          <p className="text-body-sm text-fg-muted">
            Estimated reorder cost if all suggestions are actioned:{" "}
            <span className="font-medium text-fg">{money(totalReorderCost)}</span>
          </p>
        ) : null}
      </div>

      <Card>
        <h2 className="mb-1 font-display text-h5 text-fg">Waste, expiry, and reorder signals</h2>
        <p className="mb-4 text-body-sm text-fg-muted">
          Extends the Phase 3 shortage predictor with waste probability (from the WASTE-reason
          ledger), expiry risk (days of stock on hand vs. shelf life), and a suggested reorder
          quantity. Only items needing attention are shown.
        </p>
        <DataTable
          loading={isLoading}
          rows={items}
          rowKey={(row) => row.inventoryItemId}
          emptyTitle="Nothing needs attention"
          emptyDescription="Every tracked item is stocked, low-waste, and low-expiry-risk right now."
          columns={[
            { key: "name", header: "Item", render: (row) => row.name },
            {
              key: "stock",
              header: "Current stock",
              align: "end",
              render: (row) => `${row.currentStock} ${row.unit.toLowerCase()}`,
            },
            {
              key: "days",
              header: "Days to stockout",
              align: "end",
              render: (row) => (row.daysUntilStockout !== null ? row.daysUntilStockout : "—"),
            },
            {
              key: "waste",
              header: "Waste risk",
              align: "end",
              render: (row) => (
                <Badge tone={riskTone(row.wasteProbability)}>
                  {Math.round(row.wasteProbability * 100)}%
                </Badge>
              ),
            },
            {
              key: "expiry",
              header: "Expiry risk",
              align: "end",
              render: (row) =>
                row.expiryRisk !== null ? (
                  <Badge tone={riskTone(row.expiryRisk)}>{Math.round(row.expiryRisk * 100)}%</Badge>
                ) : (
                  "N/A"
                ),
            },
            {
              key: "reorder",
              header: "Suggested reorder",
              align: "end",
              render: (row) =>
                row.suggestedReorderQuantity > 0
                  ? `${row.suggestedReorderQuantity} ${row.unit.toLowerCase()} (${money(row.suggestedReorderCost)})`
                  : "—",
            },
          ]}
        />
      </Card>
    </div>
  );
}
