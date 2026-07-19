import type { MenuItem } from "@fresh-cup/types";
import { ApiError } from "@fresh-cup/api-client";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { ProductCard } from "../../src/components/ProductCard";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useAuth } from "../../src/lib/auth-context";
import { useBranch } from "../../src/lib/branch-context";
import { useCart } from "../../src/lib/cart-context";
import { useFavorites } from "../../src/lib/favorites-context";
import { localizedText } from "../../src/lib/localized";
import { useCategories, useMenuItems } from "../../src/lib/use-menu";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

const ALL_CATEGORY = "all";

export default function MenuScreen() {
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { branchId } = useBranch();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const { data: categories = [] } = useCategories(branchId);
  const { data: itemsResult, isLoading, refetch, isRefetching } = useMenuItems(branchId);
  const items = useMemo(() => itemsResult?.items ?? [], [itemsResult]);

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

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
      router.push("/login");
      return;
    }
    try {
      await addItem({ menuItemId: item.id, quantity: 1 });
      setToast(t("catalog.addedToCart"));
      setTimeout(() => setToast(null), 2500);
    } catch (error) {
      setToast(
        error instanceof ApiError
          ? (error.problem?.detail ?? error.message)
          : t("common.somethingWentWrong"),
      );
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.searchRow}>
        <Input
          label={t("common.search")}
          hideLabel
          placeholder={t("common.searchPlaceholder")}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      {categories.length > 0 ? (
        <FlatList
          horizontal
          data={[{ id: ALL_CATEGORY, nameEn: t("catalog.allItems"), nameAm: null }, ...categories]}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const selected = item.id === selectedCategory;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedCategory(item.id)}
                style={[
                  styles.categoryPill,
                  { backgroundColor: selected ? brand.green900 : theme.tintGreen },
                ]}
              >
                <Text
                  style={{
                    color: selected ? brand.warmWhite : theme.fg,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {localizedText(item.nameEn, item.nameAm, locale)}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      {toast ? (
        <View
          style={[styles.toast, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
        >
          <Text style={{ color: theme.fg, fontSize: 13 }}>{toast}</Text>
        </View>
      ) : null}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListEmptyComponent={!isLoading ? <EmptyState title={t("catalog.noResults")} /> : null}
        renderItem={({ item }) => {
          const primaryImage = item.images.find((image) => image.isPrimary) ?? item.images[0];
          const hasModifiers = item.modifierGroups.length > 0;
          return (
            <View style={styles.cardWrap}>
              <ProductCard
                name={localizedText(item.nameEn, item.nameAm, locale)}
                description={
                  localizedText(item.descriptionEn ?? "", item.descriptionAm, locale) || undefined
                }
                priceAmount={item.basePrice}
                locale={locale}
                imageUrl={primaryImage?.url}
                unavailable={!item.isAvailable}
                unavailableLabel={t("catalog.unavailable")}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
                favoriteLabel={
                  isFavorite(item.id) ? t("catalog.favoriteRemove") : t("catalog.favoriteAdd")
                }
                onSelect={() => router.push(`/menu/${item.id}`)}
                addLabel={hasModifiers ? t("catalog.customize") : t("catalog.addToCart")}
                onAdd={
                  hasModifiers
                    ? () => router.push(`/menu/${item.id}`)
                    : () => void handleQuickAdd(item)
                }
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { paddingHorizontal: 16, paddingTop: 16 },
  categoryList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  categoryPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  toast: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  row: { gap: 12 },
  cardWrap: { flex: 1, marginBottom: 12 },
});
