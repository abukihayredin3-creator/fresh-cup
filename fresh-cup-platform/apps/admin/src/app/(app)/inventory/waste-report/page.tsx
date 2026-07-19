"use client";

import { formatMoney } from "@fresh-cup/utils";
import { DataTable, DateRangePicker, Select, StatCard, type DateRangeValue } from "@fresh-cup/ui";
import Link from "next/link";
import { useState } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useWasteReport } from "@/lib/use-inventory";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function WasteReportPage() {
  const [branchId, setBranchId] = useState("");
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useWasteReport({
    branchId: branchId || undefined,
    dateFrom: range.from,
    dateTo: range.to,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Waste Report</h1>
        <Link href="/inventory" className="text-body-sm text-accent-text hover:underline">
          Back to inventory
        </Link>
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
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <StatCard
        label="Total estimated waste cost"
        value={data ? money(data.totalEstimatedCost) : "—"}
        loading={isLoading}
      />

      <DataTable
        caption="Waste by item"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.inventoryItemId}
        emptyTitle="No waste recorded for this period"
        columns={[
          { key: "name", header: "Item", render: (row) => row.name },
          {
            key: "wasted",
            header: "Total wasted",
            render: (row) => `${row.totalWasted} ${row.unit}`,
          },
          { key: "cost", header: "Estimated cost", render: (row) => money(row.estimatedCost) },
          { key: "count", header: "Transactions", render: (row) => row.transactionCount },
        ]}
      />
    </div>
  );
}
