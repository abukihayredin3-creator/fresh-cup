import type { MenuItem } from "@fresh-cup/types";
import { ApiError } from "@fresh-cup/api-client";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { ProductCard } from "../../src/components/ProductCard";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useAuth } from "../../src/lib/auth-context";
import { useBranch } from "../../src/lib/branch-context";
import { useCart } from "../../src/lib/cart-context";
import { useFavorites } from "../../src/lib/favorites-context";
import { localizedText } from "../../src/lib/localized";
import { useMenuItems } from "../../src/lib/use-menu";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function FavoritesScreen() {
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { branchId } = useBranch();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const [toast, setToast] = useState<string | null>(null);

  const { data: itemsResult, isLoading } = useMenuItems(branchId);
  const items = useMemo(() => itemsResult?.items ?? [], [itemsResult]);
  const favoriteItems = useMemo(
    () => items.filter((item) => favoriteIds.includes(item.id)),
    [items, favoriteIds],
  );

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
      <FlatList
        data={favoriteItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title={t("favorites.empty")}
              description={t("favorites.emptyHint")}
              action={<Button onPress={() => router.push("/menu")}>{t("catalog.allItems")}</Button>}
            />
          ) : null
        }
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
                favoriteLabel={t("catalog.favoriteRemove")}
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
      {toast ? (
        <View
          style={[styles.toast, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
        >
          <Text style={{ color: theme.fg, fontSize: 13 }}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12 },
  row: { gap: 12 },
  cardWrap: { flex: 1, marginBottom: 12 },
  toast: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
});
