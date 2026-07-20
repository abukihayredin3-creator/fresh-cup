"use client";

import { Button, Card, DataTable, Dialog, Input, useToast } from "@fresh-cup/ui";
import type { Region } from "@fresh-cup/types";
import { useState } from "react";
import { useCreateRegion, useDeleteRegion, useRegions } from "@/lib/use-enterprise";

export default function EnterpriseRegionsPage() {
  const { data: regions, isLoading } = useRegions();
  const createRegion = useCreateRegion();
  const deleteRegion = useDeleteRegion();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [timezone, setTimezone] = useState("");

  async function handleCreate() {
    try {
      await createRegion.mutateAsync({ name, code, countryCode, timezone });
      showToast({ title: "Region created", tone: "success" });
      setOpen(false);
      setName("");
      setCode("");
      setCountryCode("");
      setTimezone("");
    } catch {
      showToast({ title: "Could not create region", tone: "error" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRegion.mutateAsync(id);
      showToast({ title: "Region deleted", tone: "success" });
    } catch {
      showToast({ title: "Could not delete region", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-h5 text-fg">Regions</h2>
          <Button onClick={() => setOpen(true)}>New region</Button>
        </div>
        <DataTable<Region>
          loading={isLoading}
          rows={regions ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No regions yet"
          columns={[
            { key: "name", header: "Name", render: (row) => row.name },
            { key: "code", header: "Code", render: (row) => row.code },
            { key: "country", header: "Country", render: (row) => row.countryCode },
            { key: "timezone", header: "Timezone", render: (row) => row.timezone },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(row.id)}
                  loading={deleteRegion.isPending}
                >
                  Delete
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="New region">
        <div className="flex flex-col gap-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input
            label="Country code"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            hint="ISO 3166-1 alpha-2, e.g. ET"
          />
          <Input
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            hint="IANA timezone, e.g. Africa/Addis_Ababa"
          />
          <Button onClick={handleCreate} loading={createRegion.isPending}>
            Create
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
