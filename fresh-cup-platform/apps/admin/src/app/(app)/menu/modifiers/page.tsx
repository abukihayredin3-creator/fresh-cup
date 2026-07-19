"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, Card, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useAddModifierOption,
  useCreateModifierGroup,
  useModifierGroup,
  useModifierGroups,
  useRemoveModifierOption,
  useUpdateModifierGroup,
} from "@/lib/use-menu";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

function OptionsPanel({ groupId }: { groupId: string }) {
  const { data: group, isLoading } = useModifierGroup(groupId);
  const addOption = useAddModifierOption(groupId);
  const removeOption = useRemoveModifierOption(groupId);
  const { show: showToast } = useToast();

  const [nameEn, setNameEn] = useState("");
  const [priceDelta, setPriceDelta] = useState("0");

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!nameEn.trim()) return;
    try {
      await addOption.mutateAsync({
        nameEn,
        priceDelta: Math.round(Number(priceDelta) * 100),
      });
      setNameEn("");
      setPriceDelta("0");
      showToast({ title: "Option added", tone: "success" });
    } catch {
      showToast({ title: "Could not add option", tone: "error" });
    }
  }

  async function handleRemove(optionId: string) {
    try {
      await removeOption.mutateAsync(optionId);
      showToast({ title: "Option removed", tone: "success" });
    } catch {
      showToast({ title: "Could not remove option", tone: "error" });
    }
  }

  if (isLoading || !group) {
    return <p className="text-body-sm text-fg-muted">Loading options…</p>;
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">Options for {group.nameEn}</p>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <Input label="Option name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <Input
          label="Price delta (ETB)"
          type="number"
          step="0.01"
          value={priceDelta}
          onChange={(e) => setPriceDelta(e.target.value)}
          className="w-32"
        />
        <Button type="submit" loading={addOption.isPending} disabled={!nameEn.trim()}>
          Add option
        </Button>
      </form>
      {group.options.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No options yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {group.options.map((option) => (
            <li
              key={option.id}
              className="flex items-center justify-between gap-3 rounded border border-border p-2"
            >
              <span className="text-body-sm text-fg">
                {option.nameEn}
                {option.priceDelta !== 0 ? ` (${money(option.priceDelta)})` : ""}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(option.id)}
                className="text-caption text-danger-text underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ModifierGroupsPage() {
  const [filterBranchId, setFilterBranchId] = useState("");
  const { data, isLoading } = useModifierGroups(filterBranchId || undefined);
  const { data: branches } = useAdminBranches(true);
  const createGroup = useCreateModifierGroup();
  const updateGroup = useUpdateModifierGroup();
  const { show: showToast } = useToast();

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [branchId, setBranchId] = useState("");
  const [selectionType, setSelectionType] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createGroup.mutateAsync({ nameEn, branchId, selectionType });
      showToast({ title: "Modifier group created", tone: "success" });
      setOpen(false);
      setNameEn("");
      setBranchId("");
      setSelectionType("SINGLE");
    } catch {
      setError("Could not create the modifier group. Check the details and try again.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updateGroup.mutateAsync({ id, input: { isActive: !isActive } });
      showToast({ title: "Modifier group updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update modifier group", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Modifier Groups</h1>
        <div className="flex items-center gap-3">
          <Link href="/menu" className="text-body-sm text-accent-text hover:underline">
            Back to menu
          </Link>
          <Button onClick={() => setOpen(true)}>New Group</Button>
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
        caption="Modifier groups"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No modifier groups yet"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <button
                type="button"
                onClick={() => setSelectedGroupId(row.id)}
                className="text-accent-text hover:underline"
              >
                {row.nameEn}
              </button>
            ),
          },
          { key: "branch", header: "Branch", render: (row) => branchById.get(row.branchId) ?? "—" },
          {
            key: "type",
            header: "Selection",
            render: (row) => <Badge tone="neutral">{row.selectionType}</Badge>,
          },
          { key: "options", header: "Options", render: (row) => row.options.length },
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

      {selectedGroupId ? <OptionsPanel groupId={selectedGroupId} /> : null}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="New modifier group"
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
          <Input label="Name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
          <Select
            label="Branch"
            placeholder="Select a branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <Select
            label="Selection type"
            value={selectionType}
            onChange={(e) => setSelectionType(e.target.value as "SINGLE" | "MULTIPLE")}
            options={[
              { value: "SINGLE", label: "Single choice" },
              { value: "MULTIPLE", label: "Multiple choice" },
            ]}
          />
          <Button
            type="submit"
            loading={createGroup.isPending}
            disabled={!nameEn.trim() || !branchId}
          >
            Create group
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
