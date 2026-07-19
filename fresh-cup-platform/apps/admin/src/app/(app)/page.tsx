"use client";

import { Card, LineChartWidget, Select, StatCard } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches, useDashboard, useSalesTrend } from "@/lib/use-dashboard";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  const { data: branches } = useAdminBranches(isAdmin);
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard(branchId);
  const { data: sales, isLoading: salesLoading } = useSalesTrend(branchId);

  const chartData =
    sales?.byDay.map((day) => ({
      date: day.date.slice(5),
      revenue: day.revenue / 100,
    })) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Dashboard</h1>
        {isAdmin && branches && branches.length > 0 ? (
          <Select
            label="Branch"
            hideLabel
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            placeholder="All branches"
            value={branchId ?? ""}
            onChange={(event) => setBranchId(event.target.value || undefined)}
            className="w-56"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Today's Revenue"
          value={dashboard ? money(dashboard.todayRevenue) : "—"}
          loading={dashboardLoading}
        />
        <StatCard
          label="Today's Orders"
          value={dashboard?.todayOrders ?? "—"}
          loading={dashboardLoading}
        />
        <StatCard
          label="Active Orders"
          value={dashboard?.activeOrders ?? "—"}
          loading={dashboardLoading}
        />
        <StatCard
          label="Pending Deliveries"
          value={dashboard?.pendingDeliveries ?? "—"}
          loading={dashboardLoading}
        />
        <StatCard
          label="Low Stock Items"
          value={dashboard?.lowStockItemCount ?? "—"}
          trend={dashboard && dashboard.lowStockItemCount > 0 ? "down" : "neutral"}
          delta={
            dashboard && dashboard.lowStockItemCount > 0
              ? "Needs restocking"
              : dashboard
                ? "All stocked"
                : undefined
          }
          loading={dashboardLoading}
        />
        <StatCard
          label="Last 7 Days Revenue"
          value={dashboard ? money(dashboard.last7DaysRevenue) : "—"}
          loading={dashboardLoading}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Revenue — last 7 days</h2>
        {salesLoading ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            Loading…
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            No sales in this range yet.
          </div>
        ) : (
          <LineChartWidget
            data={chartData}
            xKey="date"
            series={[{ key: "revenue", label: "Revenue (ETB)" }]}
            valueFormatter={(value) => `ETB ${value.toLocaleString()}`}
          />
        )}
      </Card>
    </div>
  );
}
