"use client";

import { Badge, Button, Card, DataTable, Dialog, Input, useToast } from "@fresh-cup/ui";
import type { Franchise } from "@fresh-cup/types";
import { useState } from "react";
import { useCreateFranchise, useFranchises } from "@/lib/use-enterprise";

export default function EnterpriseFranchisesPage() {
  const { data: franchises, isLoading } = useFranchises();
  const createFranchise = useCreateFranchise();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function handleCreate() {
    try {
      await createFranchise.mutateAsync({ name });
      showToast({ title: "Franchise created", tone: "success" });
      setOpen(false);
      setName("");
    } catch {
      showToast({ title: "Could not create franchise", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">Franchises</h2>
          <Button onClick={() => setOpen(true)}>New franchise</Button>
        </div>
        <DataTable<Franchise>
          loading={isLoading}
          rows={franchises ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No franchises yet"
          columns={[
            { key: "name", header: "Name", render: (row) => row.name },
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
              key: "created",
              header: "Created",
              render: (row) => new Date(row.createdAt).toLocaleDateString(),
            },
          ]}
        />
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="New franchise">
        <div className="flex flex-col gap-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={handleCreate} loading={createFranchise.isPending}>
            Create
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
