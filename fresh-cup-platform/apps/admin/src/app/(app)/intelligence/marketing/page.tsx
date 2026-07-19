"use client";

import { Badge, Card, DataTable } from "@fresh-cup/ui";
import { formatMoney } from "@fresh-cup/utils";
import {
  useCampaignPerformance,
  useCouponOptimization,
  useLoyaltyOptimization,
  useReferralOptimization,
  useTargetSuggestions,
} from "@/lib/use-intelligence";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

const RECOMMENDATION_TONE: Record<string, "green" | "orange" | "error"> = {
  effective: "green",
  underused: "orange",
  saturated: "error",
};

export default function MarketingIntelligencePage() {
  const { data: campaigns, isLoading: campaignsLoading } = useCampaignPerformance();
  const { data: coupons, isLoading: couponsLoading } = useCouponOptimization();
  const { data: referral } = useReferralOptimization();
  const { data: loyalty } = useLoyaltyOptimization();
  const { data: suggestions } = useTargetSuggestions();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Suggested next campaigns</h2>
        <p className="mb-4 text-body-sm text-fg-muted">
          One suggestion per RFM segment from Customer AI, with a recommended channel.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(suggestions ?? []).map((s) => (
            <div key={s.segment} className="rounded-lg border border-border p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium text-fg">{s.segment}</p>
                <Badge>{s.customerCount}</Badge>
              </div>
              <p className="text-body-sm text-fg-muted">{s.suggestion}</p>
              <p className="mt-2 text-caption text-fg-muted">via {s.recommendedChannel}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Campaign performance</h2>
        <DataTable
          loading={campaignsLoading}
          rows={campaigns ?? []}
          rowKey={(row) => row.campaignId}
          emptyTitle="No campaigns yet"
          columns={[
            { key: "name", header: "Campaign", render: (row) => row.name },
            { key: "channel", header: "Channel", render: (row) => row.channel },
            {
              key: "recipients",
              header: "Recipients",
              align: "end",
              render: (row) => row.recipientCount ?? "—",
            },
            {
              key: "lift",
              header: "Est. order lift",
              align: "end",
              render: (row) =>
                row.estimatedOrderLiftPercent !== null ? `${row.estimatedOrderLiftPercent}%` : "—",
            },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Coupon optimization</h2>
        <DataTable
          loading={couponsLoading}
          rows={coupons ?? []}
          rowKey={(row) => row.couponId}
          emptyTitle="No active coupons"
          columns={[
            { key: "code", header: "Code", render: (row) => row.code },
            {
              key: "redemptions",
              header: "Redemptions",
              align: "end",
              render: (row) =>
                `${row.redemptionCount}${row.maxRedemptions ? ` / ${row.maxRedemptions}` : ""}`,
            },
            {
              key: "aov",
              header: "AOV with coupon",
              align: "end",
              render: (row) => money(row.avgOrderValueWithCoupon),
            },
            {
              key: "baseline",
              header: "Baseline AOV",
              align: "end",
              render: (row) => money(row.avgOrderValueBaseline),
            },
            {
              key: "recommendation",
              header: "Recommendation",
              render: (row) => (
                <Badge tone={RECOMMENDATION_TONE[row.recommendation] ?? "neutral"}>
                  {row.recommendation}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-display text-h5 text-fg">Referral program</h2>
          <div className="flex flex-col gap-2 text-body-sm text-fg">
            <div className="flex justify-between">
              <span className="text-fg-muted">Codes issued</span>
              <span>{referral?.totalCodesIssued ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Redemptions</span>
              <span>{referral?.totalRedemptions ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Conversion rate</span>
              <span>{referral ? `${Math.round(referral.conversionRate * 100)}%` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Avg. cost per acquisition</span>
              <span>{referral ? money(referral.avgRewardCostPerAcquisition) : "—"}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-h5 text-fg">Loyalty program</h2>
          <div className="flex flex-col gap-2 text-body-sm text-fg">
            <div className="flex justify-between">
              <span className="text-fg-muted">Active members</span>
              <span>{loyalty?.activeMembers ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Average balance</span>
              <span>{loyalty?.avgBalance ?? "—"} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Near next tier</span>
              <span>{loyalty?.membersNearNextTier ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Unredeemed points</span>
              <span>{loyalty?.totalUnredeemedPoints ?? "—"}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
