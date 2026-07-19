"use client";

import type { ForecastGranularity, ForecastMetric } from "@fresh-cup/types";
import { Badge, Button, Card, DataTable, LineChartWidget, Select, useToast } from "@fresh-cup/ui";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useHourlyDemandForecast,
  useProductDemandForecast,
  useRegenerateForecasts,
  useSalesForecast,
} from "@/lib/use-intelligence";

const METRIC_OPTIONS: { value: ForecastMetric; label: string }[] = [
  { value: "SALES_REVENUE", label: "Revenue" },
  { value: "SALES_ORDERS", label: "Order count" },
];

const GRANULARITY_OPTIONS: { value: ForecastGranularity; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

export default function ForecastingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const { show: showToast } = useToast();

  const [metric, setMetric] = useState<ForecastMetric>("SALES_REVENUE");
  const [granularity, setGranularity] = useState<ForecastGranularity>("DAILY");
  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  const { data: series, isLoading } = useSalesForecast({ metric, granularity, branchId });
  const { data: hourly } = useHourlyDemandForecast(branchId);
  const { data: productDemand } = useProductDemandForecast(branchId);
  const regenerate = useRegenerateForecasts();

  async function handleRegenerate() {
    try {
      await regenerate.mutateAsync();
      showToast({ title: "Forecasts regenerating — refresh in a moment", tone: "success" });
    } catch {
      showToast({ title: "Could not trigger regeneration", tone: "error" });
    }
  }

  const valueUnit = metric === "SALES_REVENUE" ? "ETB" : "orders";
  const scale = metric === "SALES_REVENUE" ? 100 : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as ForecastMetric)}
            options={METRIC_OPTIONS}
          />
          <Select
            label="Granularity"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as ForecastGranularity)}
            options={GRANULARITY_OPTIONS}
          />
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
        </div>
        {user?.role === "ADMIN" ? (
          <Button variant="secondary" onClick={handleRegenerate} loading={regenerate.isPending}>
            Regenerate forecasts now
          </Button>
        ) : null}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">
            {METRIC_OPTIONS.find((m) => m.value === metric)?.label} forecast
          </h2>
          {series ? <Badge tone="neutral">model v{series.modelVersion}</Badge> : null}
        </div>
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            Loading…
          </div>
        ) : !series || series.points.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            No forecast yet — it regenerates nightly, or use &quot;Regenerate forecasts now&quot;
            above.
          </div>
        ) : (
          <LineChartWidget
            data={series.points.map((p) => ({
              date: p.targetPeriodStart.slice(5, 10),
              predicted: p.predictedValue / scale,
              ...(p.actualValue !== null ? { actual: p.actualValue / scale } : {}),
            }))}
            xKey="date"
            series={[
              { key: "predicted", label: `Predicted (${valueUnit})` },
              { key: "actual", label: `Actual (${valueUnit})` },
            ]}
            valueFormatter={(value) => `${value.toLocaleString()} ${valueUnit}`}
          />
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Tomorrow&apos;s hourly demand</h2>
        {!hourly || hourly.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-body-sm text-fg-muted">
            No hourly forecast yet.
          </div>
        ) : (
          <LineChartWidget
            data={hourly.map((h) => ({ hour: `${h.hour}:00`, orders: h.predictedOrders }))}
            xKey="hour"
            series={[{ key: "orders", label: "Predicted orders" }]}
          />
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">7-day product demand forecast</h2>
        <DataTable
          rows={productDemand ?? []}
          rowKey={(row) => row.menuItemId}
          emptyTitle="No product demand forecast yet"
          columns={[
            { key: "name", header: "Product", render: (row) => row.nameEn },
            {
              key: "next",
              header: "Tomorrow",
              align: "end",
              render: (row) => row.points[0]?.predictedValue ?? "—",
            },
            {
              key: "week",
              header: "7-day total",
              align: "end",
              render: (row) => row.points.reduce((sum, p) => sum + p.predictedValue, 0),
            },
            {
              key: "confidence",
              header: "Confidence",
              align: "end",
              render: (row) =>
                row.points[0] ? `${Math.round(row.points[0].confidence * 100)}%` : "—",
            },
          ]}
        />
      </Card>
    </div>
  );
}
