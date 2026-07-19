"use client";

import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useCreateCategory,
  useMenuCategories,
  useRemoveCategory,
  useUpdateCategory,
} from "@/lib/use-menu";

export default function CategoriesPage() {
  const [filterBranchId, setFilterBranchId] = useState("");
  const { data, isLoading } = useMenuCategories(filterBranchId || undefined);
  const { data: branches } = useAdminBranches(true);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const removeCategory = useRemoveCategory();
  const { show: showToast } = useToast();

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createCategory.mutateAsync({ nameEn, branchId });
      showToast({ title: "Category created", tone: "success" });
      setOpen(false);
      setNameEn("");
      setBranchId("");
    } catch {
      setError("Could not create the category. Check the details and try again.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updateCategory.mutateAsync({ id, input: { isActive: !isActive } });
      showToast({ title: "Category updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update category", tone: "error" });
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeCategory.mutateAsync(id);
      showToast({ title: "Category removed", tone: "success" });
    } catch {
      showToast({ title: "Could not remove category", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">Menu Categories</h1>
        <div className="flex items-center gap-3">
          <Link href="/menu" className="text-body-sm text-accent-text hover:underline">
            Back to menu
          </Link>
          <Button onClick={() => setOpen(true)}>New Category</Button>
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
        caption="Categories"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No categories yet"
        columns={[
          { key: "name", header: "Name", render: (row) => row.nameEn },
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
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleActive(row.id, row.isActive)}
                  className="text-caption text-fg-muted underline-offset-2 hover:underline"
                >
                  {row.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(row.id)}
                  className="text-caption text-danger-text underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              </div>
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
        title="New category"
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
          <Button
            type="submit"
            loading={createCategory.isPending}
            disabled={!nameEn.trim() || !branchId}
          >
            Create category
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
