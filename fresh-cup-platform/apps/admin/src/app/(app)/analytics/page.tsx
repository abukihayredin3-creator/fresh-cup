"use client";

import { Card, DataTable, LineChartWidget, StatCard } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { useSalesAnalytics } from "@/lib/use-analytics";
import { AnalyticsFilters } from "./AnalyticsFilters";
import { useAnalyticsFilters } from "./use-filters-state";
import { downloadCsv } from "@/lib/csv";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function SalesAnalyticsPage() {
  const { range, setRange, branchId, setBranchId, branches, isAdmin, params } =
    useAnalyticsFilters();
  const { data, isLoading } = useSalesAnalytics(params);

  function handleExport() {
    if (!data) return;
    downloadCsv(
      `sales-${data.from}-to-${data.to}`,
      data.byDay.map((day) => ({
        date: day.date,
        revenue_etb: (day.revenue / 100).toFixed(2),
        orders: day.orders,
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
        exportDisabled={!data || data.byDay.length === 0}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={data ? money(data.totalRevenue) : "—"}
          loading={isLoading}
        />
        <StatCard label="Total Orders" value={data?.totalOrders ?? "—"} loading={isLoading} />
        <StatCard
          label="Average Order Value"
          value={data ? money(data.averageOrderValue) : "—"}
          loading={isLoading}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Revenue by day</h2>
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            Loading…
          </div>
        ) : !data || data.byDay.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            No sales in this range.
          </div>
        ) : (
          <LineChartWidget
            data={data.byDay.map((day) => ({
              date: day.date.slice(5),
              revenue: day.revenue / 100,
            }))}
            xKey="date"
            series={[{ key: "revenue", label: "Revenue (ETB)" }]}
            valueFormatter={(value) => `ETB ${value.toLocaleString()}`}
          />
        )}
      </Card>

      <DataTable
        caption="Sales by day"
        loading={isLoading}
        rows={data?.byDay ?? []}
        rowKey={(row) => row.date}
        emptyTitle="No sales in this range"
        columns={[
          { key: "date", header: "Date", render: (row) => row.date },
          { key: "orders", header: "Orders", align: "end", render: (row) => row.orders },
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
