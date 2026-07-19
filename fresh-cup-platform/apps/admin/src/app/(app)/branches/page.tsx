"use client";

import { Badge, Button, DataTable, Dialog, Input } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useBranches, useCreateBranch } from "@/lib/use-branches";

export default function BranchesPage() {
  const { data: branches, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setAddressText("");
    setPhone("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createBranch.mutateAsync({ name, addressText, phone: phone || undefined });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the branch. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Branches</h1>
        <Button onClick={() => setOpen(true)}>New Branch</Button>
      </div>

      <DataTable
        caption="Branches"
        loading={isLoading}
        rows={branches ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No branches yet"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/branches/${row.id}`} className="text-accent-text hover:underline">
                {row.name}
              </Link>
            ),
          },
          { key: "address", header: "Address", render: (row) => row.addressText },
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
        title="New branch"
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
          <Input
            label="Address"
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            required
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" loading={createBranch.isPending}>
            Create branch
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
