"use client";

import { DataTable } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import Link from "next/link";
import { useCustomerAnalytics } from "@/lib/use-analytics";
import { downloadCsv } from "@/lib/csv";
import { AnalyticsFilters } from "../AnalyticsFilters";
import { useAnalyticsFilters } from "../use-filters-state";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function CustomerAnalyticsPage() {
  const { range, setRange, branchId, setBranchId, branches, isAdmin, params } =
    useAnalyticsFilters();
  const { data, isLoading } = useCustomerAnalytics({ ...params, limit: 25 });

  function handleExport() {
    if (!data) return;
    downloadCsv(
      `top-customers-${params.from}-to-${params.to}`,
      data.customers.map((customer) => ({
        name: customer.fullName,
        orders: customer.ordersCount,
        totalSpend_etb: (customer.totalSpend / 100).toFixed(2),
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
        exportDisabled={!data || data.customers.length === 0}
      />

      <DataTable
        caption="Top customers by spend"
        loading={isLoading}
        rows={data?.customers ?? []}
        rowKey={(row) => row.userId}
        emptyTitle="No customer orders in this range"
        columns={[
          {
            key: "name",
            header: "Customer",
            render: (row) => (
              <Link href={`/customers/${row.userId}`} className="text-accent-text hover:underline">
                {row.fullName}
              </Link>
            ),
          },
          { key: "orders", header: "Orders", align: "end", render: (row) => row.ordersCount },
          {
            key: "spend",
            header: "Total spend",
            align: "end",
            render: (row) => money(row.totalSpend),
          },
        ]}
      />
    </div>
  );
}
