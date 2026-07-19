"use client";

import { Card, DataTable, Select } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useSeasonalRecommendations, useTrendingRecommendations } from "@/lib/use-intelligence";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function RecommendationsReportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);

  const { data: trending, isLoading: trendingLoading } = useTrendingRecommendations(branchId);
  const { data: seasonal, isLoading: seasonalLoading } = useSeasonalRecommendations(branchId);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-sm text-fg-muted">
        A merchandising view of what the customer-facing recommendation engine is currently
        surfacing on the menu, product pages, and cart — trending items ranked by 7-day sales
        velocity, and seasonal/featured picks.
      </p>

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

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Trending this week</h2>
        <DataTable
          loading={trendingLoading}
          rows={trending?.items ?? []}
          rowKey={(row) => row.menuItemId}
          emptyTitle="No trending items yet"
          columns={[
            { key: "name", header: "Item", render: (row) => row.nameEn },
            { key: "price", header: "Price", align: "end", render: (row) => money(row.basePrice) },
            {
              key: "score",
              header: "Relevance score",
              align: "end",
              render: (row) => row.score.toFixed(2),
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Seasonal &amp; featured picks</h2>
        <DataTable
          loading={seasonalLoading}
          rows={seasonal?.items ?? []}
          rowKey={(row) => row.menuItemId}
          emptyTitle="No seasonal or featured items marked"
          columns={[
            { key: "name", header: "Item", render: (row) => row.nameEn },
            { key: "price", header: "Price", align: "end", render: (row) => money(row.basePrice) },
            { key: "reason", header: "Reason", render: (row) => row.reason },
          ]}
        />
      </Card>
    </div>
  );
}
