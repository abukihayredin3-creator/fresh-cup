"use client";

import { ApiError } from "@fresh-cup/api-client";
import type { Locale, MenuItemModifierGroup } from "@fresh-cup/types";
import {
  Button,
  IconButton,
  PriceTag,
  QuantityStepper,
  Skeleton,
  Textarea,
  useToast,
} from "@fresh-cup/ui";
import { useLocale, useTranslations } from "next-intl";
import { use, useMemo, useState } from "react";
import { renderProductImage } from "@/components/ProductImage";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useFavorites } from "@/lib/favorites-context";
import { localizedText } from "@/lib/localized";
import { useMenuItem } from "@/lib/use-menu";

function isGroupSatisfied(group: MenuItemModifierGroup, selected: string[]): boolean {
  return selected.length >= group.minSelect;
}

export default function ProductDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params);
  // next-intl's useLocale() isn't narrowed to our locale union without global module
  // augmentation; routing.ts already constrains it to `locales`.
  const locale = useLocale() as Locale;
  const t = useTranslations("catalog");
  const common = useTranslations("common");
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const toast = useToast();

  const { data: item, isLoading } = useMenuItem(itemId);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    const modifierTotal = item.modifierGroups.reduce((sum, group) => {
      const selectedIds = selections[group.id] ?? [];
      const groupTotal = group.options
        .filter((option) => selectedIds.includes(option.id))
        .reduce((optionSum, option) => optionSum + option.priceDelta, 0);
      return sum + groupTotal;
    }, 0);
    return item.basePrice + modifierTotal;
  }, [item, selections]);

  const allRequiredSatisfied = useMemo(() => {
    if (!item) return false;
    return item.modifierGroups
      .filter((group) => group.isRequired)
      .every((group) => isGroupSatisfied(group, selections[group.id] ?? []));
  }, [item, selections]);

  function toggleOption(group: MenuItemModifierGroup, optionId: string) {
    setSelections((current) => {
      const selected = current[group.id] ?? [];
      if (group.selectionType === "SINGLE") {
        return {
          ...current,
          [group.id]: selected.includes(optionId) && !group.isRequired ? [] : [optionId],
        };
      }
      const isSelected = selected.includes(optionId);
      if (isSelected) {
        return { ...current, [group.id]: selected.filter((id) => id !== optionId) };
      }
      if (group.maxSelect !== null && selected.length >= group.maxSelect) {
        return current;
      }
      return { ...current, [group.id]: [...selected, optionId] };
    });
  }

  async function handleAddToCart() {
    if (!item) return;
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent(`/menu/${itemId}`)}`);
      return;
    }
    setSubmitting(true);
    try {
      await addItem({
        menuItemId: item.id,
        quantity,
        notes: notes.trim() || undefined,
        modifierOptionIds: Object.values(selections).flat(),
      });
      toast.show({ title: t("addedToCart"), tone: "success" });
      router.push("/menu");
    } catch (error) {
      toast.show({
        title:
          error instanceof ApiError
            ? (error.problem?.detail ?? error.message)
            : common("somethingWentWrong"),
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="mb-6 aspect-[4/3] w-full" />
        <Skeleton className="mb-2 h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <p className="font-display text-h4 text-fg">{common("somethingWentWrong")}</p>
      </div>
    );
  }

  const images = item.images.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const activeImage = images[selectedImageIndex] ?? images[0];
  const name = localizedText(item.nameEn, item.nameAm, locale);
  const description = localizedText(item.descriptionEn ?? "", item.descriptionAm, locale);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 text-body-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
      >
        &larr; {common("back")}
      </button>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-tint-green">
            {activeImage
              ? renderProductImage({ src: activeImage.url, alt: activeImage.altText ?? name })
              : null}
            <IconButton
              aria-label={isFavorite(item.id) ? t("favoriteRemove") : t("favoriteAdd")}
              aria-pressed={isFavorite(item.id)}
              onClick={() => toggleFavorite(item.id)}
              variant="solid"
              className="absolute right-2 top-2 bg-surface-alt/90 text-fg hover:bg-surface-alt"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M12 21s-7.5-4.6-10-9.1C0.3 8.4 2.1 5 5.6 5c2 0 3.4 1 4.4 2.4C11 6 12.4 5 14.4 5c3.5 0 5.3 3.4 3.6 6.9C19.5 16.4 12 21 12 21z"
                  fill={isFavorite(item.id) ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </IconButton>
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  aria-label={`${common("viewDetails")} ${index + 1}`}
                  aria-pressed={index === selectedImageIndex}
                  className={`relative h-16 w-16 overflow-hidden rounded border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                    index === selectedImageIndex ? "border-orange-600" : "border-transparent"
                  }`}
                >
                  {renderProductImage({ src: image.url, alt: image.altText ?? name })}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-h3 text-fg">{name}</h1>
            {description ? <p className="mt-2 text-body text-fg-muted">{description}</p> : null}
          </div>

          <div className="flex items-center gap-4">
            <PriceTag amount={unitPrice} locale={locale} className="text-h4 font-medium text-fg" />
            {item.calories ? (
              <span className="text-body-sm text-fg-muted">
                {t("calories", { count: item.calories })}
              </span>
            ) : null}
          </div>

          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill bg-tint-green px-2 py-0.5 text-caption text-fg"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {item.modifierGroups.map((group) => {
            const selected = selections[group.id] ?? [];
            return (
              <fieldset key={group.id} className="rounded-lg border border-border p-4">
                <legend className="px-1 text-body-sm font-medium text-fg">
                  {localizedText(group.nameEn, group.nameAm, locale)}
                  {group.isRequired ? (
                    <span className="ml-2 text-caption text-accent-text">
                      {t("modifierRequired", { min: group.minSelect })}
                    </span>
                  ) : (
                    <span className="ml-2 text-caption text-fg-muted">{t("modifierOptional")}</span>
                  )}
                </legend>
                <div className="mt-2 flex flex-col gap-2">
                  {group.options.map((option) => {
                    const checked = selected.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-tint-green"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type={group.selectionType === "SINGLE" ? "radio" : "checkbox"}
                            name={group.id}
                            checked={checked}
                            disabled={!option.isActive}
                            onChange={() => toggleOption(group, option.id)}
                            className="h-4 w-4 accent-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                          />
                          <span className="text-body-sm text-fg">
                            {localizedText(option.nameEn, option.nameAm, locale)}
                          </span>
                        </span>
                        {option.priceDelta !== 0 ? (
                          <PriceTag
                            amount={option.priceDelta}
                            locale={locale}
                            className="text-caption text-fg-muted"
                          />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <QuantityStepper value={quantity} onChange={setQuantity} label={`${name} quantity`} />

          <Textarea
            label={t("modifierOptional")}
            hideLabel
            placeholder={common("optional")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
          />

          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!item.isAvailable || !allRequiredSatisfied}
            onClick={() => void handleAddToCart()}
          >
            {item.isAvailable ? t("addToCart") : t("unavailable")}
          </Button>
        </div>
      </div>
    </div>
  );
}
