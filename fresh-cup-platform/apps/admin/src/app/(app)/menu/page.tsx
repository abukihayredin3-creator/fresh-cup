"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, DataTable, Dialog, Input, Select, Textarea, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useCreateMenuItem, useMenuCategories, useMenuItems } from "@/lib/use-menu";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

export default function MenuPage() {
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data: filterCategories } = useMenuCategories(branchId || undefined);
  const { data, isLoading } = useMenuItems({
    branchId: branchId || undefined,
    categoryId: categoryId || undefined,
  });
  const createItem = useCreateMenuItem();
  const { show: showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: createCategories } = useMenuCategories(newBranchId || undefined);

  const categoryById = new Map(
    [...(filterCategories?.items ?? []), ...(createCategories?.items ?? [])].map((c) => [
      c.id,
      c.nameEn,
    ]),
  );

  function resetForm() {
    setNameEn("");
    setDescriptionEn("");
    setBasePrice("");
    setNewBranchId("");
    setNewCategoryId("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createItem.mutateAsync({
        branchId: newBranchId,
        categoryId: newCategoryId,
        nameEn,
        descriptionEn: descriptionEn || undefined,
        basePrice: Math.round(Number(basePrice) * 100),
      });
      showToast({ title: "Menu item created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the menu item. Check the details and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Menu</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/menu/categories" className="text-body-sm text-accent-text hover:underline">
            Categories
          </Link>
          <Link href="/menu/modifiers" className="text-body-sm text-accent-text hover:underline">
            Modifier Groups
          </Link>
          <Button onClick={() => setOpen(true)}>New Item</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          label="Filter by branch"
          hideLabel
          placeholder="All branches"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          className="w-56"
        />
        <Select
          label="Filter by category"
          hideLabel
          placeholder="All categories"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={(filterCategories?.items ?? []).map((c) => ({ value: c.id, label: c.nameEn }))}
          className="w-56"
        />
      </div>

      <DataTable
        caption="Menu items"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No menu items found"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/menu/${row.id}`} className="text-accent-text hover:underline">
                {row.nameEn}
              </Link>
            ),
          },
          {
            key: "category",
            header: "Category",
            render: (row) => categoryById.get(row.categoryId) ?? "—",
          },
          { key: "price", header: "Price", render: (row) => money(row.basePrice) },
          {
            key: "available",
            header: "Available",
            render: (row) => (
              <Badge tone={row.isAvailable ? "green" : "neutral"}>
                {row.isAvailable ? "Available" : "Unavailable"}
              </Badge>
            ),
          },
          {
            key: "flags",
            header: "Flags",
            render: (row) => (
              <div className="flex flex-wrap gap-1">
                {row.isPopular ? <Badge tone="orange">Popular</Badge> : null}
                {row.isFeatured ? <Badge tone="orange">Featured</Badge> : null}
                {row.isSeasonal ? <Badge tone="orange">Seasonal</Badge> : null}
              </div>
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
        title="New menu item"
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
          <Textarea
            label="Description"
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
          />
          <Input
            label="Base price (ETB)"
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
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
            label="Category"
            placeholder="Select a category"
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(e.target.value)}
            options={(createCategories?.items ?? []).map((c) => ({ value: c.id, label: c.nameEn }))}
          />
          <Button
            type="submit"
            loading={createItem.isPending}
            disabled={!nameEn.trim() || !basePrice || !newBranchId || !newCategoryId}
          >
            Create item
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
