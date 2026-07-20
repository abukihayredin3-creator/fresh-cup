"use client";

import { Badge, Button, Card, DataTable, StatCard, useToast } from "@fresh-cup/ui";
import type { BranchBenchmark, RegionRollup } from "@fresh-cup/types";
import { api } from "@/lib/api-client";
import {
  useAggregatedForecast,
  useBranchBenchmark,
  useCorporateDashboard,
  useCrossRegionAnalytics,
  useExecutiveScorecard,
} from "@/lib/use-enterprise";

function downloadTextFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatMinor(minor: number): string {
  return (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function EnterpriseAnalyticsPage() {
  const { data: dashboard, isLoading: isDashboardLoading } = useCorporateDashboard();
  const { data: crossRegion, isLoading: isCrossRegionLoading } = useCrossRegionAnalytics();
  const { data: benchmark, isLoading: isBenchmarkLoading } = useBranchBenchmark();
  const { data: scorecard, isLoading: isScorecardLoading } = useExecutiveScorecard();
  const { data: forecast, isLoading: isForecastLoading } = useAggregatedForecast();
  const { show: showToast } = useToast();

  async function handleExport(kind: "corporate-dashboard" | "benchmark" | "scorecard") {
    try {
      const file =
        kind === "corporate-dashboard"
          ? await api.admin.enterprise.exportCorporateDashboardCsv()
          : kind === "benchmark"
            ? await api.admin.enterprise.exportBenchmarkCsv()
            : await api.admin.enterprise.exportScorecardCsv();
      downloadTextFile(file.filename, file.mimeType, file.content);
    } catch {
      showToast({ title: "Export failed", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue growth vs. prior period"
          value={scorecard ? `${scorecard.revenueGrowthPercent}%` : "—"}
          trend={scorecard && scorecard.revenueGrowthPercent >= 0 ? "up" : "down"}
          loading={isScorecardLoading}
        />
        <StatCard
          label="Top branch"
          value={scorecard?.topBranch?.name ?? "—"}
          loading={isScorecardLoading}
        />
        <StatCard
          label="Bottom branch"
          value={scorecard?.bottomBranch?.name ?? "—"}
          loading={isScorecardLoading}
        />
        <StatCard
          label="Org-wide forecasted revenue"
          value={forecast ? `${formatMinor(forecast.totalPredictedRevenueMinor)}` : "—"}
          delta={
            forecast
              ? `${Math.round(forecast.averageConfidence * 100)}% avg. confidence`
              : undefined
          }
          loading={isForecastLoading}
        />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">Corporate dashboard (last 30 days)</h2>
          <Button variant="ghost" onClick={() => void handleExport("corporate-dashboard")}>
            Export CSV
          </Button>
        </div>
        <DataTable
          loading={isDashboardLoading}
          rows={dashboard?.byBranch ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No branch revenue in this period"
          columns={[
            { key: "name", header: "Branch", render: (row) => row.name },
            {
              key: "revenue",
              header: "Revenue",
              align: "end",
              render: (row) => formatMinor(row.revenueMinor),
            },
            { key: "orders", header: "Orders", align: "end", render: (row) => row.orderCount },
            {
              key: "aov",
              header: "Avg. order value",
              align: "end",
              render: (row) => formatMinor(row.averageOrderValueMinor),
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Cross-region breakdown</h2>
        <DataTable<RegionRollup>
          loading={isCrossRegionLoading}
          rows={crossRegion ?? []}
          rowKey={(row) => row.regionId ?? "unassigned"}
          emptyTitle="No regions with branches"
          columns={[
            { key: "region", header: "Region", render: (row) => row.regionName },
            { key: "branches", header: "Branches", align: "end", render: (row) => row.branchCount },
            {
              key: "revenue",
              header: "Revenue",
              align: "end",
              render: (row) => formatMinor(row.totalRevenueMinor),
            },
            { key: "orders", header: "Orders", align: "end", render: (row) => row.totalOrders },
          ]}
        />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">Branch benchmark</h2>
          <Button variant="ghost" onClick={() => void handleExport("benchmark")}>
            Export CSV
          </Button>
        </div>
        <DataTable<BranchBenchmark>
          loading={isBenchmarkLoading}
          rows={benchmark ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No branches to benchmark"
          columns={[
            { key: "rank", header: "#", render: (row) => row.rank },
            { key: "name", header: "Branch", render: (row) => row.name },
            {
              key: "revenue",
              header: "Revenue",
              align: "end",
              render: (row) => formatMinor(row.revenueMinor),
            },
            {
              key: "vsAverage",
              header: "vs. org average",
              align: "end",
              render: (row) => (
                <Badge tone={row.percentVsAverage >= 0 ? "green" : "error"}>
                  {row.percentVsAverage >= 0 ? "+" : ""}
                  {row.percentVsAverage}%
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">Executive scorecard</h2>
          <Button variant="ghost" onClick={() => void handleExport("scorecard")}>
            Export CSV
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Branches"
            value={scorecard?.branchCount ?? "—"}
            loading={isScorecardLoading}
          />
          <StatCard
            label="Total revenue"
            value={scorecard ? formatMinor(scorecard.totalRevenueMinor) : "—"}
            loading={isScorecardLoading}
          />
          <StatCard
            label="Previous period revenue"
            value={scorecard ? formatMinor(scorecard.previousPeriodRevenueMinor) : "—"}
            loading={isScorecardLoading}
          />
        </div>
      </Card>
    </div>
  );
}
