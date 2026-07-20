"use client";

import { Badge, Button, Card, DataTable, StatCard, useToast } from "@fresh-cup/ui";
import type { SubscriptionPlan } from "@fresh-cup/types";
import {
  useCancelSubscription,
  usePlans,
  useSeatUsage,
  useSubscribe,
  useSubscription,
} from "@/lib/use-enterprise";

export default function EnterpriseLicensingPage() {
  const { data: plans, isLoading: isPlansLoading } = usePlans();
  const { data: subscription, isLoading: isSubscriptionLoading } = useSubscription();
  const { data: seatUsage, isLoading: isSeatUsageLoading } = useSeatUsage();
  const subscribe = useSubscribe();
  const cancelSubscription = useCancelSubscription();
  const { show: showToast } = useToast();

  const currentPlan = plans?.find((p) => p.id === subscription?.planId);

  async function handleSubscribe(planKey: string) {
    try {
      await subscribe.mutateAsync({ planKey });
      showToast({ title: `Subscribed to ${planKey}`, tone: "success" });
    } catch {
      showToast({ title: "Could not update subscription", tone: "error" });
    }
  }

  async function handleCancel() {
    try {
      await cancelSubscription.mutateAsync();
      showToast({ title: "Subscription cancelled", tone: "success" });
    } catch {
      showToast({ title: "Could not cancel subscription", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Current plan"
          value={currentPlan?.name ?? "None"}
          loading={isSubscriptionLoading || isPlansLoading}
        />
        <StatCard
          label="Subscription status"
          value={subscription?.status ?? "—"}
          loading={isSubscriptionLoading}
        />
        <StatCard
          label="Seats used"
          value={seatUsage ? `${seatUsage.used} / ${seatUsage.seats}` : "—"}
          trend={seatUsage && !seatUsage.withinLimit ? "down" : "neutral"}
          delta={seatUsage && !seatUsage.withinLimit ? "Over seat limit" : undefined}
          loading={isSeatUsageLoading}
        />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">Plans</h2>
          {subscription ? (
            <Button variant="ghost" onClick={handleCancel} loading={cancelSubscription.isPending}>
              Cancel subscription
            </Button>
          ) : null}
        </div>
        <DataTable<SubscriptionPlan>
          loading={isPlansLoading}
          rows={plans ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No plans available"
          columns={[
            { key: "name", header: "Plan", render: (row) => row.name },
            {
              key: "price",
              header: "Price / month",
              render: (row) =>
                row.priceMonthlyMinor != null ? `${(row.priceMonthlyMinor / 100).toFixed(2)}` : "—",
            },
            {
              key: "maxBranches",
              header: "Max branches",
              render: (row) => row.maxBranches ?? "Unlimited",
            },
            { key: "maxUsers", header: "Max users", render: (row) => row.maxUsers ?? "Unlimited" },
            {
              key: "current",
              header: "",
              render: (row) =>
                row.id === subscription?.planId ? (
                  <Badge tone="green">Current</Badge>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => handleSubscribe(row.key)}
                    loading={subscribe.isPending}
                  >
                    Switch to this plan
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
