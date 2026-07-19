"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useCreateDeliveryZone, useDeliveryZones, useUpdateDeliveryZone } from "@/lib/use-delivery";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function DeliveryZonesPage() {
  const [filterBranchId, setFilterBranchId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useDeliveryZones({ branchId: filterBranchId || undefined });
  const createZone = useCreateDeliveryZone();
  const updateZone = useUpdateDeliveryZone();
  const { show: showToast } = useToast();

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("5");
  const [baseFee, setBaseFee] = useState("");
  const [perKmFee, setPerKmFee] = useState("0");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setBranchId("");
    setCenterLat("");
    setCenterLng("");
    setRadiusKm("5");
    setBaseFee("");
    setPerKmFee("0");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createZone.mutateAsync({
        name,
        branchId,
        centerLat: Number(centerLat),
        centerLng: Number(centerLng),
        radiusKm: Number(radiusKm),
        baseFee: Math.round(Number(baseFee) * 100),
        perKmFee: Math.round(Number(perKmFee) * 100),
      });
      showToast({ title: "Delivery zone created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the delivery zone. Check the details and try again.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updateZone.mutateAsync({ id, input: { isActive: !isActive } });
      showToast({ title: "Delivery zone updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update delivery zone", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Delivery Zones</h1>
        <div className="flex items-center gap-3">
          <Link href="/delivery" className="text-body-sm text-accent-text hover:underline">
            Back to delivery
          </Link>
          <Button onClick={() => setOpen(true)}>New Zone</Button>
        </div>
      </div>

      <Select
        label="Filter by branch"
        hideLabel
        placeholder="All branches"
        value={filterBranchId}
        onChange={(e) => setFilterBranchId(e.target.value)}
        options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
        className="w-56"
      />

      <DataTable
        caption="Delivery zones"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No delivery zones yet"
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          { key: "branch", header: "Branch", render: (row) => branchById.get(row.branchId) ?? "—" },
          { key: "radius", header: "Radius", render: (row) => `${row.radiusKm} km` },
          { key: "baseFee", header: "Base fee", render: (row) => money(row.baseFee) },
          { key: "perKmFee", header: "Per km", render: (row) => money(row.perKmFee) },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge tone={row.isActive ? "green" : "neutral"}>
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            align: "end",
            render: (row) => (
              <button
                type="button"
                onClick={() => handleToggleActive(row.id, row.isActive)}
                className="text-caption text-fg-muted underline-offset-2 hover:underline"
              >
                {row.isActive ? "Deactivate" : "Activate"}
              </button>
            ),
          },
        ]}
      />

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="New delivery zone"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {error ? (
            <p
              role="alert"
              className="rounded border border-error-600 bg-error-600/15 px-3 py-2 text-body-sm text-fg"
            >
              {error}
            </p>
          ) : null}
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select
            label="Branch"
            placeholder="Select a branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <div className="flex gap-3">
            <Input
              label="Center latitude"
              type="number"
              step="0.000001"
              value={centerLat}
              onChange={(e) => setCenterLat(e.target.value)}
              required
            />
            <Input
              label="Center longitude"
              type="number"
              step="0.000001"
              value={centerLng}
              onChange={(e) => setCenterLng(e.target.value)}
              required
            />
          </div>
          <Input
            label="Radius (km)"
            type="number"
            min={0}
            step="0.1"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
          />
          <div className="flex gap-3">
            <Input
              label="Base fee (ETB)"
              type="number"
              min={0}
              step="0.01"
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              required
            />
            <Input
              label="Per km fee (ETB)"
              type="number"
              min={0}
              step="0.01"
              value={perKmFee}
              onChange={(e) => setPerKmFee(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            loading={createZone.isPending}
            disabled={!name.trim() || !branchId || !centerLat || !centerLng || !baseFee}
          >
            Create zone
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
