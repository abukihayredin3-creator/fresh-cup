"use client";

import { Badge, Button, DataTable, Dialog, Input, Select, useToast } from "@fresh-cup/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import { useBanners, useCreateBanner, useRemoveBanner, useUpdateBanner } from "@/lib/use-marketing";

export default function MarketingPage() {
  const [filterBranchId, setFilterBranchId] = useState("");
  const { data: branches } = useAdminBranches(true);
  const { data, isLoading } = useBanners({ branchId: filterBranchId || undefined });
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const removeBanner = useRemoveBanner();
  const { show: showToast } = useToast();

  const branchById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setImageUrl("");
    setLinkUrl("");
    setBranchId("");
    setError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createBanner.mutateAsync({
        title,
        imageUrl,
        linkUrl: linkUrl || undefined,
        branchId: branchId || undefined,
      });
      showToast({ title: "Banner created", tone: "success" });
      setOpen(false);
      resetForm();
    } catch {
      setError("Could not create the banner. Check the details and try again.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updateBanner.mutateAsync({ id, input: { isActive: !isActive } });
      showToast({ title: "Banner updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update banner", tone: "error" });
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeBanner.mutateAsync(id);
      showToast({ title: "Banner removed", tone: "success" });
    } catch {
      showToast({ title: "Could not remove banner", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h3 text-fg">Marketing — Banners</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/marketing/gift-cards"
            className="text-body-sm text-accent-text hover:underline"
          >
            Gift Cards
          </Link>
          <Link
            href="/marketing/referrals"
            className="text-body-sm text-accent-text hover:underline"
          >
            Referrals
          </Link>
          <Link
            href="/marketing/campaigns"
            className="text-body-sm text-accent-text hover:underline"
          >
            Campaigns
          </Link>
          <Button onClick={() => setOpen(true)}>New Banner</Button>
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
        caption="Banners"
        loading={isLoading}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No banners yet"
        columns={[
          { key: "title", header: "Title", render: (row) => row.title },
          {
            key: "branch",
            header: "Branch",
            render: (row) =>
              row.branchId ? (branchById.get(row.branchId) ?? "—") : "All branches",
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
          resetForm();
        }}
        title="New banner"
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
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
          />
          <Input
            label="Link URL (optional)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <Select
            label="Branch"
            placeholder="All branches"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <Button
            type="submit"
            loading={createBanner.isPending}
            disabled={!title.trim() || !imageUrl.trim()}
          >
            Create banner
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
