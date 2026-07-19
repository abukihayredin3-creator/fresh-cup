"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, DataTable, Select } from "@fresh-cup/ui";
import type { BadgeProps } from "@fresh-cup/ui";
import type { DeliveryStatus } from "@fresh-cup/types";
import Link from "next/link";
import { useState } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useDeliveries } from "@/lib/use-delivery";

const STATUS_TONE: Record<DeliveryStatus, NonNullable<BadgeProps["tone"]>> = {
  UNASSIGNED: "neutral",
  ASSIGNED: "orange",
  PICKED_UP: "orange",
  EN_ROUTE: "orange",
  DELIVERED: "green",
  FAILED: "error",
};

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function DeliveryPage() {
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<DeliveryStatus | "">("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useDeliveries({
    branchId: branchId || undefined,
    status: status || undefined,
  });

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Delivery</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/delivery/drivers" className="text-body-sm text-accent-text hover:underline">
            Drivers
          </Link>
          <Link href="/delivery/zones" className="text-body-sm text-accent-text hover:underline">
            Zones
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          label="Filter by branch"
          hideLabel
          placeholder="All branches"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          className="w-56"
        />
        <Select
          label="Filter by status"
          hideLabel
          placeholder="All statuses"
          value={status}
          onChange={(e) => setStatus(e.target.value as DeliveryStatus | "")}
          options={[
            { value: "UNASSIGNED", label: "Unassigned" },
            { value: "ASSIGNED", label: "Assigned" },
            { value: "PICKED_UP", label: "Picked up" },
            { value: "EN_ROUTE", label: "En route" },
            { value: "DELIVERED", label: "Delivered" },
            { value: "FAILED", label: "Failed" },
          ]}
          className="w-56"
        />
      </div>

      <DataTable
        caption="Deliveries"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No deliveries found"
        columns={[
          {
            key: "id",
            header: "Delivery",
            render: (row) => (
              <Link href={`/delivery/${row.id}`} className="text-accent-text hover:underline">
                {row.id.slice(0, 8)}
              </Link>
            ),
          },
          { key: "branch", header: "Branch", render: (row) => branchById.get(row.branchId) ?? "—" },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
          },
          {
            key: "distance",
            header: "Distance",
            render: (row) => (row.distanceKm !== null ? `${row.distanceKm.toFixed(1)} km` : "—"),
          },
          { key: "fee", header: "Fee", render: (row) => money(row.fee) },
        ]}
      />
    </div>
  );
}
