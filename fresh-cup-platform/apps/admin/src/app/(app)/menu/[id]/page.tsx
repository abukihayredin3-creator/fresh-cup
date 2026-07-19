"use client";

import { formatMoney } from "@fresh-cup/utils";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
  Tabs,
  Textarea,
  useToast,
} from "@fresh-cup/ui";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useAdminBranches } from "@/lib/use-dashboard";
import {
  useAddMenuItemImage,
  useAttachModifierGroup,
  useDetachModifierGroup,
  useMenuCategories,
  useMenuItem,
  useModifierGroups,
  useRemoveMenuItemImage,
  useSetMenuItemAvailability,
  useUpdateMenuItem,
} from "@/lib/use-menu";

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

function DetailsTab({ itemId }: { itemId: string }) {
  const { data: item, isLoading } = useMenuItem(itemId);
  const { data: categories } = useMenuCategories(item?.branchId);
  const updateItem = useUpdateMenuItem(itemId);
  const setAvailability = useSetMenuItemAvailability();
  const { show: showToast } = useToast();

  const [nameEn, setNameEn] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isPopular, setIsPopular] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isSeasonal, setIsSeasonal] = useState(false);

  useEffect(() => {
    if (!item) return;
    // eslint-disable-next-line -- populates the edit form once the menu item loads
    setNameEn(item.nameEn);
    setDescriptionEn(item.descriptionEn ?? "");
    setBasePrice((item.basePrice / 100).toFixed(2));
    setCategoryId(item.categoryId);
    setIsAvailable(item.isAvailable);
    setIsPopular(item.isPopular);
    setIsFeatured(item.isFeatured);
    setIsSeasonal(item.isSeasonal);
  }, [item]);

  async function handleSave() {
    if (!item) return;
    try {
      await updateItem.mutateAsync({
        nameEn,
        descriptionEn: descriptionEn || undefined,
        basePrice: Math.round(Number(basePrice) * 100),
        categoryId,
        isPopular,
        isFeatured,
        isSeasonal,
      });
      if (isAvailable !== item.isAvailable) {
        await setAvailability.mutateAsync({ id: itemId, isAvailable });
      }
      showToast({ title: "Menu item updated", tone: "success" });
    } catch {
      showToast({ title: "Could not update menu item", tone: "error" });
    }
  }

  if (isLoading || !item) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
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
      />
      <Select
        label="Category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        options={(categories?.items ?? []).map((c) => ({ value: c.id, label: c.nameEn }))}
      />
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-body-sm text-fg">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Available for ordering
        </label>
        <label className="flex items-center gap-2 text-body-sm text-fg">
          <input
            type="checkbox"
            checked={isPopular}
            onChange={(e) => setIsPopular(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Popular
        </label>
        <label className="flex items-center gap-2 text-body-sm text-fg">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-body-sm text-fg">
          <input
            type="checkbox"
            checked={isSeasonal}
            onChange={(e) => setIsSeasonal(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Seasonal
        </label>
      </div>
      <div>
        <Button onClick={handleSave} loading={updateItem.isPending}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

function ImagesTab({ itemId }: { itemId: string }) {
  const { data: item, isLoading } = useMenuItem(itemId);
  const addImage = useAddMenuItemImage(itemId);
  const removeImage = useRemoveMenuItemImage(itemId);
  const { show: showToast } = useToast();

  const [url, setUrl] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  async function handleAdd() {
    if (!url.trim()) return;
    try {
      await addImage.mutateAsync({ url, isPrimary });
      setUrl("");
      setIsPrimary(false);
      showToast({ title: "Image added", tone: "success" });
    } catch {
      showToast({ title: "Could not add image", tone: "error" });
    }
  }

  async function handleRemove(imageId: string) {
    try {
      await removeImage.mutateAsync(imageId);
      showToast({ title: "Image removed", tone: "success" });
    } catch {
      showToast({ title: "Could not remove image", tone: "error" });
    }
  }

  if (isLoading || !item) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-64"
        />
        <label className="flex items-center gap-2 text-body-sm text-fg">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Primary
        </label>
        <Button onClick={handleAdd} loading={addImage.isPending} disabled={!url.trim()}>
          Add image
        </Button>
      </div>
      {item.images.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No images yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {item.images.map((image) => (
            <li
              key={image.id}
              className="flex items-center justify-between gap-3 rounded border border-border p-2"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {image.isPrimary ? <Badge tone="orange">Primary</Badge> : null}
                <span className="truncate text-body-sm text-fg">{image.url}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(image.id)}
                className="shrink-0 text-caption text-danger-text underline-offset-2 hover:underline"
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

function ModifiersTab({ itemId }: { itemId: string }) {
  const { data: item, isLoading } = useMenuItem(itemId);
  const { data: allGroups } = useModifierGroups(item?.branchId);
  const attachGroup = useAttachModifierGroup(itemId);
  const detachGroup = useDetachModifierGroup(itemId);
  const { show: showToast } = useToast();

  const [selectedGroupId, setSelectedGroupId] = useState("");

  const attachedGroupIds = new Set((item?.modifierGroups ?? []).map((g) => g.modifierGroupId));
  const availableGroups = (allGroups?.items ?? []).filter((g) => !attachedGroupIds.has(g.id));

  async function handleAttach() {
    if (!selectedGroupId) return;
    try {
      await attachGroup.mutateAsync({ modifierGroupId: selectedGroupId });
      setSelectedGroupId("");
      showToast({ title: "Modifier group attached", tone: "success" });
    } catch {
      showToast({ title: "Could not attach modifier group", tone: "error" });
    }
  }

  async function handleDetach(linkId: string) {
    try {
      await detachGroup.mutateAsync(linkId);
      showToast({ title: "Modifier group detached", tone: "success" });
    } catch {
      showToast({ title: "Could not detach modifier group", tone: "error" });
    }
  }

  if (isLoading || !item) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Attach modifier group"
          placeholder="Select a group"
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          options={availableGroups.map((g) => ({ value: g.id, label: g.nameEn }))}
          className="min-w-56"
        />
        <Button onClick={handleAttach} loading={attachGroup.isPending} disabled={!selectedGroupId}>
          Attach
        </Button>
      </div>
      {item.modifierGroups.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No modifier groups attached.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {item.modifierGroups.map((group) => (
            <li
              key={group.id}
              className="flex items-center justify-between gap-3 rounded border border-border p-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-fg">{group.nameEn}</span>
                <Badge tone="neutral">{group.selectionType}</Badge>
                {group.isRequired ? <Badge tone="orange">Required</Badge> : null}
              </div>
              <button
                type="button"
                onClick={() => handleDetach(group.id)}
                className="text-caption text-danger-text underline-offset-2 hover:underline"
              >
                Detach
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function MenuItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState("details");
  const { data: item } = useMenuItem(id);
  const { data: branches } = useAdminBranches(true);
  const branchName = (branches ?? []).find((b) => b.id === item?.branchId)?.name;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-h3 text-fg">{item?.nameEn ?? "Menu item"}</h1>
          {item ? (
            <p className="text-body-sm text-fg-muted">
              {branchName ?? "—"} · {money(item.basePrice)}
            </p>
          ) : null}
        </div>
        <Link href="/menu" className="text-body-sm text-accent-text hover:underline">
          Back to menu
        </Link>
      </div>
      <Tabs
        label="Menu item section"
        items={[
          { id: "details", label: "Details" },
          { id: "images", label: "Images" },
          { id: "modifiers", label: "Modifiers" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "details" ? <DetailsTab itemId={id} /> : null}
      {tab === "images" ? <ImagesTab itemId={id} /> : null}
      {tab === "modifiers" ? <ModifiersTab itemId={id} /> : null}
    </div>
  );
}
