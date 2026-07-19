"use client";

import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useCreateKitchenStation,
  useKitchenStations,
  useUpdateKitchenStation,
} from "@/lib/use-kitchen";

export default function KitchenPage() {
  const [filterBranchId, setFilterBranchId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useKitchenStations({ branchId: filterBranchId || undefined });
  const createStation = useCreateKitchenStation();
  const updateStation = useUpdateKitchenStation();
  const { show: showToast } = useToast();

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createStation.mutateAsync({ name, branchId });
      showToast({ title: "Kitchen station created", tone: "success" });
      setOpen(false);
      setName("");
      setBranchId("");
    } catch {
      setError("Could not create the kitchen station. Check the details and try again.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updateStation.mutateAsync({ id, input: { isActive: !isActive } });
      showToast({ title: "Kitchen station updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update kitchen station", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Kitchen Stations</h1>
        <Button onClick={() => setOpen(true)}>New Station</Button>
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
        caption="Kitchen stations"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No kitchen stations yet"
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          { key: "branch", header: "Branch", render: (row) => branchById.get(row.branchId) ?? "—" },
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
          setError(null);
        }}
        title="New kitchen station"
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
          <Button
            type="submit"
            loading={createStation.isPending}
            disabled={!name.trim() || !branchId}
          >
            Create station
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
