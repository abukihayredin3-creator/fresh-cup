"use client";

import { ApiError } from "@fresh-cup/api-client";
import type { Locale, MenuItem } from "@fresh-cup/types";
import {
  EmptyState,
  Input,
  ProductCard,
  Skeleton,
  Tabs,
  useToast,
  type TabItem,
} from "@fresh-cup/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { renderProductImage } from "@/components/ProductImage";
import { RecommendationRow } from "@/components/RecommendationRow";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useBranch } from "@/lib/branch-context";
import { useCart } from "@/lib/cart-context";
import { useFavorites } from "@/lib/favorites-context";
import { localizedText } from "@/lib/localized";
import { useCategories, useMenuItems } from "@/lib/use-menu";
import {
  usePersonalizedRecommendations,
  useTrendingRecommendations,
} from "@/lib/use-recommendations";

const ALL_CATEGORY = "all";

export default function MenuPage() {
  // next-intl's useLocale() isn't narrowed to our locale union without global
  // module augmentation; routing.ts already constrains it to `locales`.
  const locale = useLocale() as Locale;
  const t = useTranslations("catalog");
  const common = useTranslations("common");
  const router = useRouter();
  const { branchId } = useBranch();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const toast = useToast();

  const { data: categories = [], isLoading: categoriesLoading } = useCategories(branchId);
  const { data: itemsResult, isLoading: itemsLoading } = useMenuItems(branchId);
  const items = useMemo(() => itemsResult?.items ?? [], [itemsResult]);
  const { data: trending } = useTrendingRecommendations(branchId);
  const { data: personalized } = usePersonalizedRecommendations(branchId, Boolean(user));

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [query, setQuery] = useState("");

  const tabs: TabItem[] = useMemo(
    () => [
      { id: ALL_CATEGORY, label: t("allItems") },
      ...categories.map((category) => ({
        id: category.id,
        label: localizedText(category.nameEn, category.nameAm, locale),
      })),
    ],
    [categories, locale, t],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategory !== ALL_CATEGORY && item.categoryId !== selectedCategory) return false;
      if (!normalizedQuery) return true;
      const name = localizedText(item.nameEn, item.nameAm, locale).toLowerCase();
      const description = localizedText(
        item.descriptionEn ?? "",
        item.descriptionAm,
        locale,
      ).toLowerCase();
      return name.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [items, selectedCategory, query, locale]);

  async function handleQuickAdd(item: MenuItem) {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent("/menu")}`);
      return;
    }
    try {
      await addItem({ menuItemId: item.id, quantity: 1 });
      toast.show({ title: t("addedToCart"), tone: "success" });
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

  const isLoading = categoriesLoading || itemsLoading;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-h3 text-fg">{t("allItems")}</h1>

      {selectedCategory === ALL_CATEGORY && !query ? (
        <div className="mb-8 flex flex-col gap-8">
          {personalized && personalized.items.length > 0 ? (
            <RecommendationRow
              title={t("recommendedForYou")}
              items={personalized.items}
              locale={locale}
            />
          ) : (
            <RecommendationRow
              title={t("trending")}
              items={trending?.items ?? []}
              locale={locale}
            />
          )}
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4">
        <Input
          type="search"
          label={common("search")}
          hideLabel
          placeholder={common("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {tabs.length > 1 ? (
          <Tabs
            items={tabs}
            value={selectedCategory}
            onChange={setSelectedCategory}
            label={t("categories")}
          />
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] w-full" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState title={t("noResults")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
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
                unavailableLabel={t("unavailable")}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                favoriteLabel={isFavorite(item.id) ? t("favoriteRemove") : t("favoriteAdd")}
                onSelect={() => router.push(`/menu/${item.id}`)}
                addLabel={hasModifiers ? t("customize") : t("addToCart")}
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
