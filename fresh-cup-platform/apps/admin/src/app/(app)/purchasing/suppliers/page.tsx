"use client";

import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useCreateSupplier, useSuppliers } from "@/lib/use-purchasing";

export default function SuppliersPage() {
  const [branchId, setBranchId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useSuppliers({ branchId: branchId || undefined });
  const createSupplier = useCreateSupplier();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setNewBranchId("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createSupplier.mutateAsync({
        branchId: newBranchId,
        name,
        contactName: contactName || undefined,
        phone: phone || undefined,
        email: email || undefined,
      });
      showToast({ title: "Supplier created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the supplier. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Suppliers</h1>
        <div className="flex items-center gap-3">
          <Link href="/purchasing" className="text-body-sm text-accent-text hover:underline">
            Back to purchasing
          </Link>
          <Button onClick={() => setOpen(true)}>New Supplier</Button>
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
        caption="Suppliers"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No suppliers found"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link
                href={`/purchasing/suppliers/${row.id}`}
                className="text-accent-text hover:underline"
              >
                {row.name}
              </Link>
            ),
          },
          { key: "contact", header: "Contact", render: (row) => row.contactName ?? "—" },
          { key: "phone", header: "Phone", render: (row) => row.phone ?? "—" },
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
        title="New supplier"
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
            value={newBranchId}
            onChange={(e) => setNewBranchId(e.target.value)}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <Input
            label="Contact name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            type="submit"
            loading={createSupplier.isPending}
            disabled={!name.trim() || !newBranchId}
          >
            Create supplier
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
