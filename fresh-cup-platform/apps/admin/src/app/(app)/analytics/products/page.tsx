"use client";

import { BarChartWidget, Card, DataTable } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { useItemAnalytics } from "@/lib/use-analytics";
import { downloadCsv } from "@/lib/csv";
import { AnalyticsFilters } from "../AnalyticsFilters";
import { useAnalyticsFilters } from "../use-filters-state";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function ProductAnalyticsPage() {
  const { range, setRange, branchId, setBranchId, branches, isAdmin, params } =
    useAnalyticsFilters();
  const { data, isLoading } = useItemAnalytics({ ...params, limit: 15 });

  function handleExport() {
    if (!data) return;
    downloadCsv(
      `top-products-${params.from}-to-${params.to}`,
      data.items.map((item) => ({
        name: item.name,
        quantitySold: item.quantitySold,
        revenue_etb: (item.revenue / 100).toFixed(2),
      })),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsFilters
        range={range}
        onRangeChange={setRange}
        branchId={branchId}
        onBranchChange={setBranchId}
        branches={branches}
        showBranchFilter={isAdmin}
        onExport={handleExport}
        exportDisabled={!data || data.items.length === 0}
      />

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Top-selling items by revenue</h2>
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            Loading…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            No sales in this range.
          </div>
        ) : (
          <BarChartWidget
            data={data.items.map((item) => ({ name: item.name, revenue: item.revenue / 100 }))}
            xKey="name"
            series={[{ key: "revenue", label: "Revenue (ETB)" }]}
            valueFormatter={(value) => `ETB ${value.toLocaleString()}`}
          />
        )}
      </Card>

      <DataTable
        caption="Top-selling menu items"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.menuItemId}
        emptyTitle="No item sales in this range"
        columns={[
          { key: "name", header: "Item", render: (row) => row.name },
          {
            key: "quantitySold",
            header: "Qty sold",
            align: "end",
            render: (row) => row.quantitySold,
          },
          {
            key: "revenue",
            header: "Revenue",
            align: "end",
            render: (row) => money(row.revenue),
          },
        ]}
      />
    </div>
  );
}
