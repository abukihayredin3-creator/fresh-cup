"use client";

import { Card, DataTable, LineChartWidget, StatCard } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { AnalyticsFilters } from "../analytics/AnalyticsFilters";
import { useExecutiveOverview, useForecastVsActual } from "@/lib/use-intelligence";
import { useIntelligenceFilters } from "./use-intelligence-filters";
import { downloadCsv } from "@/lib/csv";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function ExecutiveOverviewPage() {
  const { range, setRange, branchId, setBranchId, branches, isAdmin, params } =
    useIntelligenceFilters();
  const { data, isLoading } = useExecutiveOverview(params);
  const { data: forecastVsActual } = useForecastVsActual(branchId);

  function handleExport() {
    if (!data) return;
    downloadCsv(
      `executive-overview-${data.from}-to-${data.to}`,
      data.revenueTrend.map((point) => ({
        date: point.date,
        revenue_etb: (point.revenue / 100).toFixed(2),
        estimated_profit_etb: (point.estimatedProfit / 100).toFixed(2),
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
        exportDisabled={!data || data.revenueTrend.length === 0}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={data ? money(data.totalRevenue) : "—"}
          loading={isLoading}
        />
        <StatCard
          label="Estimated profit"
          value={data ? money(data.totalEstimatedProfit) : "—"}
          loading={isLoading}
        />
        <StatCard
          label="Repeat customer rate"
          value={data ? `${Math.round(data.repeatCustomerRate * 100)}%` : "—"}
          loading={isLoading}
        />
        <StatCard
          label="Cart → order conversion"
          value={data ? `${Math.round(data.conversionMetrics.conversionRate * 100)}%` : "—"}
          loading={isLoading}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Revenue vs. estimated profit</h2>
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            Loading…
          </div>
        ) : !data || data.revenueTrend.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-body-sm text-fg-muted">
            No orders in this range.
          </div>
        ) : (
          <LineChartWidget
            data={data.revenueTrend.map((point) => ({
              date: point.date.slice(5),
              revenue: point.revenue / 100,
              profit: point.estimatedProfit / 100,
            }))}
            xKey="date"
            series={[
              { key: "revenue", label: "Revenue (ETB)" },
              { key: "profit", label: "Est. profit (ETB)" },
            ]}
            valueFormatter={(value) => `ETB ${value.toLocaleString()}`}
          />
        )}
      </Card>

      {forecastVsActual && forecastVsActual.points.length > 0 ? (
        <Card>
          <h2 className="mb-4 font-display text-h5 text-fg">
            Forecast vs. actual daily revenue{" "}
            <span className="text-body-sm font-normal text-fg-muted">
              (model v{forecastVsActual.modelVersion})
            </span>
          </h2>
          <LineChartWidget
            data={forecastVsActual.points.map((point) => ({
              date: point.targetPeriodStart.slice(5, 10),
              predicted: point.predictedValue / 100,
              ...(point.actualValue !== null ? { actual: point.actualValue / 100 } : {}),
            }))}
            xKey="date"
            series={[
              { key: "predicted", label: "Predicted (ETB)" },
              { key: "actual", label: "Actual (ETB)" },
            ]}
            valueFormatter={(value) => `ETB ${value.toLocaleString()}`}
          />
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-h5 text-fg">Branch comparison</h2>
          <DataTable
            loading={isLoading}
            rows={data?.branchComparison ?? []}
            rowKey={(row) => row.branchId}
            emptyTitle="No branch data"
            columns={[
              { key: "name", header: "Branch", render: (row) => row.name },
              { key: "orders", header: "Orders", align: "end", render: (row) => row.orders },
              {
                key: "revenue",
                header: "Revenue",
                align: "end",
                render: (row) => money(row.revenue),
              },
              {
                key: "avg",
                header: "Avg order",
                align: "end",
                render: (row) => money(row.avgOrderValue),
              },
            ]}
          />
        </Card>

        <Card>
          <h2 className="mb-4 font-display text-h5 text-fg">Peak hours</h2>
          {isLoading ? (
            <div className="flex h-[240px] items-center justify-center text-body-sm text-fg-muted">
              Loading…
            </div>
          ) : !data || data.peakHours.length === 0 ? (
            <div className="flex h-[240px] items-center justify-center text-body-sm text-fg-muted">
              No orders in this range.
            </div>
          ) : (
            <LineChartWidget
              data={data.peakHours.map((h) => ({ hour: `${h.hour}:00`, orders: h.orderCount }))}
              xKey="hour"
              series={[{ key: "orders", label: "Orders" }]}
            />
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Product profitability (top 15)</h2>
        <DataTable
          loading={isLoading}
          rows={data?.productProfitability ?? []}
          rowKey={(row) => row.menuItemId}
          emptyTitle="No product sales in this range"
          columns={[
            { key: "name", header: "Product", render: (row) => row.nameEn },
            {
              key: "revenue",
              header: "Revenue",
              align: "end",
              render: (row) => money(row.revenue),
            },
            {
              key: "cogs",
              header: "Est. COGS",
              align: "end",
              render: (row) => money(row.estimatedCogs),
            },
            {
              key: "margin",
              header: "Est. margin",
              align: "end",
              render: (row) => money(row.estimatedMargin),
            },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-display text-h5 text-fg">Inventory costs</h2>
          <div className="flex flex-col gap-2 text-body-sm text-fg">
            <div className="flex justify-between">
              <span className="text-fg-muted">Purchasing spend</span>
              <span>{data ? money(data.inventoryCosts.purchasingSpend) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Waste cost</span>
              <span>{data ? money(data.inventoryCosts.wasteCost) : "—"}</span>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-display text-h5 text-fg">Marketing ROI (coupons)</h2>
          <div className="flex flex-col gap-2 text-body-sm text-fg">
            <div className="flex justify-between">
              <span className="text-fg-muted">Discount given</span>
              <span>{data ? money(data.marketingRoi.couponDiscountGiven) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Revenue from coupon orders</span>
              <span>{data ? money(data.marketingRoi.revenueFromCouponOrders) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Return per discount birr</span>
              <span>
                {data?.marketingRoi.returnPerDiscountBirr !== null && data
                  ? `${data.marketingRoi.returnPerDiscountBirr}x`
                  : "—"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
