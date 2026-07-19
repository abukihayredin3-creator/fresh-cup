"use client";

import { ApiError } from "@fresh-cup/api-client";
import type { Locale, MenuItem } from "@fresh-cup/types";
import { EmptyState, ProductCard, Skeleton, useToast } from "@fresh-cup/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { renderProductImage } from "@/components/ProductImage";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useBranch } from "@/lib/branch-context";
import { useCart } from "@/lib/cart-context";
import { useFavorites } from "@/lib/favorites-context";
import { localizedText } from "@/lib/localized";
import { useMenuItems } from "@/lib/use-menu";

export default function FavoritesPage() {
  // next-intl's useLocale() isn't narrowed to our locale union without global module
  // augmentation; routing.ts already constrains it to `locales`.
  const locale = useLocale() as Locale;
  const t = useTranslations("favorites");
  const catalogT = useTranslations("catalog");
  const common = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const { branchId } = useBranch();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();

  const { data: itemsResult, isLoading } = useMenuItems(branchId);
  const items = useMemo(() => itemsResult?.items ?? [], [itemsResult]);
  const favoriteItems = useMemo(
    () => items.filter((item) => favoriteIds.includes(item.id)),
    [items, favoriteIds],
  );

  async function handleQuickAdd(item: MenuItem) {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent("/favorites")}`);
      return;
    }
    try {
      await addItem({ menuItemId: item.id, quantity: 1 });
      toast.show({ title: catalogT("addedToCart"), tone: "success" });
    } catch (error) {
      toast.show({
        title:
          error instanceof ApiError
            ? (error.problem?.detail ?? error.message)
            : common("somethingWentWrong"),
        tone: "error",
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-h3 text-green-900 dark:text-green-700">{t("title")}</h1>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : favoriteItems.length === 0 ? (
        <EmptyState
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Link
              href="/menu"
              className="inline-flex items-center justify-center rounded bg-orange-600 px-4 py-2 text-body font-medium text-white hover:bg-orange-600/90"
            >
              {catalogT("allItems")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favoriteItems.map((item) => {
            const primaryImage = item.images.find((image) => image.isPrimary) ?? item.images[0];
            const hasModifiers = item.modifierGroups.length > 0;
            return (
              <ProductCard
                key={item.id}
                name={localizedText(item.nameEn, item.nameAm, locale)}
                description={
                  localizedText(item.descriptionEn ?? "", item.descriptionAm, locale) || undefined
                }
                priceAmount={item.basePrice}
                locale={locale}
                imageUrl={primaryImage?.url}
                imageAlt={primaryImage?.altText ?? undefined}
                tags={item.tags}
                unavailable={!item.isAvailable}
                unavailableLabel={catalogT("unavailable")}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                favoriteLabel={catalogT("favoriteRemove")}
                onSelect={() => router.push(`/menu/${item.id}`)}
                addLabel={hasModifiers ? catalogT("customize") : catalogT("addToCart")}
                onAdd={
                  hasModifiers
                    ? () => router.push(`/menu/${item.id}`)
                    : () => void handleQuickAdd(item)
                }
                renderImage={renderProductImage}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
