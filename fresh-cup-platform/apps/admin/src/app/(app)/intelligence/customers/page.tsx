"use client";

import { Badge, BarChartWidget, Card, DataTable, Dialog, Select, Skeleton } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useCustomerIntelligenceProfile,
  useCustomerSegments,
  useSegmentSummary,
} from "@/lib/use-intelligence";

const SEGMENT_TONE: Record<string, "green" | "orange" | "error" | "neutral"> = {
  Champions: "green",
  "Loyal Customers": "green",
  "New Customers": "neutral",
  "At Risk": "orange",
  "Need Attention": "orange",
  Lost: "error",
};

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function CustomerIntelligencePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: branches } = useAdminBranches(isAdmin);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [segment, setSegment] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: summaryData } = useSegmentSummary(branchId);
  const { data: segmentsData, isLoading } = useCustomerSegments({ branchId, segment, limit: 50 });
  const { data: profile, isLoading: profileLoading } =
    useCustomerIntelligenceProfile(selectedUserId);
  const summary = summaryData?.segments;
  const segments = segmentsData?.customers;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
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
        <Select
          label="Segment"
          value={segment ?? ""}
          onChange={(e) => setSegment(e.target.value || undefined)}
          options={(summary ?? []).map((s) => ({ value: s.segment, label: s.segment }))}
          placeholder="All segments"
          className="w-56"
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">RFM segment breakdown</h2>
        {!summary || summary.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-body-sm text-fg-muted">
            No customer order history yet.
          </div>
        ) : (
          <BarChartWidget
            data={summary.map((s) => ({ segment: s.segment, customers: s.customerCount }))}
            xKey="segment"
            series={[{ key: "customers", label: "Customers" }]}
          />
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Customers</h2>
        <DataTable
          loading={isLoading}
          rows={segments ?? []}
          rowKey={(row) => row.userId}
          emptyTitle="No customers match this filter"
          onRowClick={(row) => setSelectedUserId(row.userId)}
          columns={[
            { key: "name", header: "Customer", render: (row) => row.fullName },
            {
              key: "segment",
              header: "Segment",
              render: (row) => (
                <Badge tone={SEGMENT_TONE[row.segment] ?? "neutral"}>{row.segment}</Badge>
              ),
            },
            { key: "orders", header: "Orders", align: "end", render: (row) => row.ordersCount },
            {
              key: "spend",
              header: "Total spend",
              align: "end",
              render: (row) => money(row.totalSpend),
            },
            {
              key: "churn",
              header: "Churn risk",
              align: "end",
              render: (row) => `${Math.round(row.churnRisk * 100)}%`,
            },
            {
              key: "ltv",
              header: "Predicted LTV",
              align: "end",
              render: (row) => money(row.predictedLtv),
            },
          ]}
        />
      </Card>

      <Dialog
        open={selectedUserId !== null}
        onClose={() => setSelectedUserId(null)}
        title={profile?.fullName ?? "Customer profile"}
      >
        {profileLoading || !profile ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-body-sm text-fg">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-fg-muted">Segment</p>
                <Badge tone={SEGMENT_TONE[profile.segment] ?? "neutral"}>{profile.segment}</Badge>
              </div>
              <div>
                <p className="text-fg-muted">Churn risk</p>
                <p>{Math.round(profile.churnRisk * 100)}%</p>
              </div>
              <div>
                <p className="text-fg-muted">Predicted LTV</p>
                <p>{money(profile.predictedLtv)}</p>
              </div>
              <div>
                <p className="text-fg-muted">Avg order value</p>
                <p>{money(profile.avgOrderValue)}</p>
              </div>
              <div>
                <p className="text-fg-muted">Purchase frequency</p>
                <p>
                  {profile.purchaseFrequencyDays !== null
                    ? `every ~${profile.purchaseFrequencyDays} days`
                    : "single order"}
                </p>
              </div>
              <div>
                <p className="text-fg-muted">Preferred order time</p>
                <p>
                  {profile.preferredOrderHour !== null ? `${profile.preferredOrderHour}:00` : "—"}
                </p>
              </div>
              <div>
                <p className="text-fg-muted">Preferred payment</p>
                <p>{profile.preferredPaymentMethod ?? "—"}</p>
              </div>
              <div>
                <p className="text-fg-muted">Loyalty tier</p>
                <p>
                  {profile.loyaltyProgression.tier} ({profile.loyaltyProgression.currentBalance}{" "}
                  pts)
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-fg">Favorite categories</p>
              {profile.favoriteCategories.length === 0 ? (
                <p className="text-fg-muted">None yet</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {profile.favoriteCategories.map((c) => (
                    <li key={c.categoryId}>
                      <Badge>
                        {c.name} ({c.orderCount})
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1 font-medium text-fg">Coupon effectiveness</p>
              <p className="text-fg-muted">
                {profile.couponEffectiveness.ordersWithCoupon} order(s) with a coupon (avg{" "}
                {money(profile.couponEffectiveness.avgOrderValueWithCoupon)}) vs.{" "}
                {profile.couponEffectiveness.ordersWithoutCoupon} without (avg{" "}
                {money(profile.couponEffectiveness.avgOrderValueWithoutCoupon)}).
              </p>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
