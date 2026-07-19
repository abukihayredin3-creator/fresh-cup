"use client";

import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useCreateDriver, useDrivers } from "@/lib/use-delivery";

export default function DriversPage() {
  const [branchId, setBranchId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useDrivers({ branchId: branchId || undefined });
  const createDriver = useCreateDriver();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("MOTORBIKE");
  const [licensePlate, setLicensePlate] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setVehicleType("MOTORBIKE");
    setLicensePlate("");
    setNewBranchId("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createDriver.mutateAsync({
        branchId: newBranchId,
        email,
        password,
        fullName,
        vehicleType,
        licensePlate: licensePlate || undefined,
      });
      showToast({ title: "Driver created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the driver. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Drivers</h1>
        <div className="flex items-center gap-3">
          <Link href="/delivery" className="text-body-sm text-accent-text hover:underline">
            Back to delivery
          </Link>
          <Button onClick={() => setOpen(true)}>New Driver</Button>
        </div>
      </div>

      <Select
        label="Filter by branch"
        hideLabel
        placeholder="All branches"
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
        className="w-56"
      />

      <DataTable
        caption="Drivers"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No drivers found"
        columns={[
          { key: "name", header: "Name", render: (row) => row.fullName },
          { key: "vehicle", header: "Vehicle", render: (row) => row.vehicleType },
          { key: "plate", header: "Plate", render: (row) => row.licensePlate ?? "—" },
          {
            key: "online",
            header: "Online",
            render: (row) => (
              <Badge tone={row.isOnline ? "green" : "neutral"}>
                {row.isOnline ? "Online" : "Offline"}
              </Badge>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge tone={row.isActive ? "green" : "neutral"}>
                {row.isActive ? "Active" : "Inactive"}
              </Badge>
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
        title="New driver"
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
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Minimum 8 characters"
            required
          />
          <Select
            label="Branch"
            placeholder="Select a branch"
            value={newBranchId}
            onChange={(e) => setNewBranchId(e.target.value)}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <Select
            label="Vehicle type"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            options={[
              { value: "MOTORBIKE", label: "Motorbike" },
              { value: "BICYCLE", label: "Bicycle" },
              { value: "CAR", label: "Car" },
            ]}
          />
          <Input
            label="License plate"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
          />
          <Button
            type="submit"
            loading={createDriver.isPending}
            disabled={!fullName.trim() || !email.trim() || !password || !newBranchId}
          >
            Create driver
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
