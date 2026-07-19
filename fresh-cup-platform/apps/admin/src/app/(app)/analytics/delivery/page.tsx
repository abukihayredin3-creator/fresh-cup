"use client";

import { BarChartWidget, Card, DataTable, StatCard } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { useDeliveryAnalytics } from "@/lib/use-analytics";
import { downloadCsv } from "@/lib/csv";
import { AnalyticsFilters } from "../AnalyticsFilters";
import { useAnalyticsFilters } from "../use-filters-state";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function DeliveryAnalyticsPage() {
  const { range, setRange, branchId, setBranchId, branches, isAdmin, params } =
    useAnalyticsFilters();
  const { data, isLoading } = useDeliveryAnalytics(params);

  function handleExport() {
    if (!data) return;
    downloadCsv(
      `delivery-performance-${data.from}-to-${data.to}`,
      data.byZone.map((zone) => ({
        zone: zone.zoneName,
        deliveredCount: zone.deliveredCount,
        avgFee_etb: (zone.avgFee / 100).toFixed(2),
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
        exportDisabled={!data || data.byZone.length === 0}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Deliveries"
          value={data?.totalDeliveries ?? "—"}
          loading={isLoading}
        />
        <StatCard
          label="Completed Deliveries"
          value={data?.completedDeliveries ?? "—"}
          loading={isLoading}
        />
        <StatCard
          label="Average Delivery Time"
          value={
            data?.avgDeliveryMinutes !== undefined && data?.avgDeliveryMinutes !== null
              ? `${Math.round(data.avgDeliveryMinutes)} min`
              : "—"
          }
          loading={isLoading}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Deliveries by zone</h2>
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            Loading…
          </div>
        ) : !data || data.byZone.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            No deliveries in this range.
          </div>
        ) : (
          <BarChartWidget
            data={data.byZone.map((zone) => ({
              zone: zone.zoneName,
              delivered: zone.deliveredCount,
            }))}
            xKey="zone"
            series={[{ key: "delivered", label: "Deliveries" }]}
          />
        )}
      </Card>

      <DataTable
        caption="Delivery zone performance"
        loading={isLoading}
        rows={data?.byZone ?? []}
        rowKey={(row) => row.zoneId ?? "unzoned"}
        emptyTitle="No deliveries in this range"
        columns={[
          { key: "zone", header: "Zone", render: (row) => row.zoneName },
          {
            key: "delivered",
            header: "Delivered",
            align: "end",
            render: (row) => row.deliveredCount,
          },
          { key: "avgFee", header: "Avg. fee", align: "end", render: (row) => money(row.avgFee) },
        ]}
      />
    </div>
  );
}
