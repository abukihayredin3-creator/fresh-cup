"use client";

import { BarChartWidget, Card, DataTable, StatCard } from "@fresh-cup/ui";
import { useKitchenAnalytics } from "@/lib/use-analytics";
import { downloadCsv } from "@/lib/csv";
import { AnalyticsFilters } from "../AnalyticsFilters";
import { useAnalyticsFilters } from "../use-filters-state";

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

export default function KitchenAnalyticsPage() {
  const { range, setRange, branchId, setBranchId, branches, isAdmin, params } =
    useAnalyticsFilters();
  const { data, isLoading } = useKitchenAnalytics(params);

  function handleExport() {
    if (!data) return;
    downloadCsv(
      `kitchen-performance-${data.from}-to-${data.to}`,
      data.byStation.map((station) => ({
        station: station.stationName,
        itemCount: station.itemCount,
        avgEstimatedPrepSeconds: station.avgEstimatedPrepSeconds.toFixed(1),
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
        exportDisabled={!data || data.byStation.length === 0}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Completed Orders"
          value={data?.completedOrders ?? "—"}
          loading={isLoading}
        />
        <StatCard
          label="Average Prep Time"
          value={data ? formatSeconds(data.avgPrepSeconds) : "—"}
          loading={isLoading}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Items prepared by station</h2>
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            Loading…
          </div>
        ) : !data || data.byStation.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            No kitchen activity in this range.
          </div>
        ) : (
          <BarChartWidget
            data={data.byStation.map((station) => ({
              station: station.stationName,
              items: station.itemCount,
            }))}
            xKey="station"
            series={[{ key: "items", label: "Items prepared" }]}
          />
        )}
      </Card>

      <DataTable
        caption="Kitchen station performance"
        loading={isLoading}
        rows={data?.byStation ?? []}
        rowKey={(row) => row.stationId}
        emptyTitle="No kitchen activity in this range"
        columns={[
          { key: "station", header: "Station", render: (row) => row.stationName },
          { key: "items", header: "Items", align: "end", render: (row) => row.itemCount },
          {
            key: "avgPrep",
            header: "Avg. estimated prep time",
            align: "end",
            render: (row) => formatSeconds(row.avgEstimatedPrepSeconds),
          },
        ]}
      />
    </div>
  );
}
