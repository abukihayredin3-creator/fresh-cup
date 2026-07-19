"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, Card, DataTable, Select, Skeleton, useToast } from "@fresh-cup/ui";
import type { BadgeProps } from "@fresh-cup/ui";
import type { DeliveryStatus } from "@fresh-cup/types";
import Link from "next/link";
import { use, useState } from "react";
import { useAssignDriver, useDelivery, useDeliveryTracking, useDrivers } from "@/lib/use-delivery";

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

function AssignDriverCard({ deliveryId, branchId }: { deliveryId: string; branchId: string }) {
  const { data: drivers } = useDrivers({ branchId });
  const assignDriver = useAssignDriver(deliveryId);
  const { show: showToast } = useToast();
  const [driverId, setDriverId] = useState("");

  async function handleAssign() {
    if (!driverId) return;
    try {
      await assignDriver.mutateAsync(driverId);
      showToast({ title: "Driver assigned", tone: "success" });
    } catch {
      showToast({ title: "Could not assign driver", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-wrap items-end gap-3">
      <Select
        label="Assign driver"
        placeholder="Select a driver"
        value={driverId}
        onChange={(e) => setDriverId(e.target.value)}
        options={(drivers?.items ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
        className="min-w-56"
      />
      <Button onClick={handleAssign} loading={assignDriver.isPending} disabled={!driverId}>
        Assign
      </Button>
    </Card>
  );
}

function TrackingCard({ deliveryId }: { deliveryId: string }) {
  const { data, isLoading } = useDeliveryTracking(deliveryId);

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">GPS tracking</p>
      <DataTable
        caption="Tracking pings"
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No tracking pings recorded"
        columns={[
          { key: "lat", header: "Lat", render: (row) => row.lat.toFixed(5) },
          { key: "lng", header: "Lng", render: (row) => row.lng.toFixed(5) },
          {
            key: "time",
            header: "Recorded at",
            render: (row) =>
              new Date(row.recordedAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              }),
          },
        ]}
      />
    </Card>
  );
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: delivery, isLoading } = useDelivery(id);

  if (isLoading || !delivery) {
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
          <h1 className="font-display text-h3 text-fg">Delivery {delivery.id.slice(0, 8)}</h1>
          <Badge tone={STATUS_TONE[delivery.status]}>{delivery.status}</Badge>
        </div>
        <Link href="/delivery" className="text-body-sm text-accent-text hover:underline">
          Back to delivery
        </Link>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-body-sm text-fg-muted">Order: {delivery.orderId}</p>
        <p className="text-body-sm text-fg-muted">
          Distance: {delivery.distanceKm !== null ? `${delivery.distanceKm.toFixed(1)} km` : "—"}
        </p>
        <p className="text-body-sm text-fg-muted">Fee: {money(delivery.fee)}</p>
      </Card>

      {delivery.status === "UNASSIGNED" ? (
        <AssignDriverCard deliveryId={id} branchId={delivery.branchId} />
      ) : null}

      <TrackingCard deliveryId={id} />
    </div>
  );
}
