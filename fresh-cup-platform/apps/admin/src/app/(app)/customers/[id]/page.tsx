"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, Card, Skeleton, StatCard, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { use } from "react";
import { useCustomerDetail } from "@/lib/use-analytics";
import { useCustomer, useSetCustomerActive } from "@/lib/use-customers";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: customer, isLoading } = useCustomer(id);
  const { data: detail, isLoading: detailLoading } = useCustomerDetail(id);
  const setActive = useSetCustomerActive(id);
  const { show: showToast } = useToast();

  async function handleToggleActive() {
    if (!customer) return;
    try {
      await setActive.mutateAsync(!customer.isActive);
      showToast({ title: "Customer updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update customer", tone: "error" });
    }
  }

  if (isLoading || !customer) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-h3 text-fg">{customer.fullName}</h1>
          <Badge tone={customer.isActive ? "green" : "neutral"}>
            {customer.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <Link href="/customers" className="text-body-sm text-accent-text hover:underline">
          Back to customers
        </Link>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-body-sm text-fg-muted">Email: {customer.email ?? "—"}</p>
        <p className="text-body-sm text-fg-muted">Phone: {customer.phone ?? "—"}</p>
        <p className="text-body-sm text-fg-muted">
          Joined: {new Date(customer.createdAt).toLocaleDateString()}
        </p>
        <div>
          <Button onClick={handleToggleActive} loading={setActive.isPending}>
            {customer.isActive ? "Deactivate account" : "Activate account"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Orders" value={detail?.ordersCount ?? "—"} loading={detailLoading} />
        <StatCard
          label="Total spend"
          value={detail ? money(detail.totalSpend) : "—"}
          loading={detailLoading}
        />
        <StatCard
          label="Loyalty balance"
          value={detail?.loyaltyBalance ?? "—"}
          loading={detailLoading}
        />
        <StatCard
          label="Last order"
          value={detail?.lastOrderAt ? new Date(detail.lastOrderAt).toLocaleDateString() : "—"}
          loading={detailLoading}
        />
      </div>
    </div>
  );
}
