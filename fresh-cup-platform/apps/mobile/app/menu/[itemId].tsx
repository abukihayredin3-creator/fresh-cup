import { ApiError } from "@fresh-cup/api-client";
import type { MenuItemModifierGroup } from "@fresh-cup/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { PriceTag } from "../../src/components/PriceTag";
import { QuantityStepper } from "../../src/components/QuantityStepper";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useAuth } from "../../src/lib/auth-context";
import { useCart } from "../../src/lib/cart-context";
import { useFavorites } from "../../src/lib/favorites-context";
import { localizedText } from "../../src/lib/localized";
import { useMenuItem } from "../../src/lib/use-menu";
import { useTheme } from "../../src/theme/ThemeProvider";

function isGroupSatisfied(group: MenuItemModifierGroup, selected: string[]): boolean {
  return selected.length >= group.minSelect;
}

export default function ProductDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const { data: item, isLoading } = useMenuItem(itemId);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    const modifierTotal = item.modifierGroups.reduce((sum, group) => {
      const selectedIds = selections[group.id] ?? [];
      return (
        sum +
        group.options
          .filter((option) => selectedIds.includes(option.id))
          .reduce((s, option) => s + option.priceDelta, 0)
      );
    }, 0);
    return item.basePrice + modifierTotal;
  }, [item, selections]);

  const allRequiredSatisfied = useMemo(() => {
    if (!item) return false;
    return item.modifierGroups
      .filter((g) => g.isRequired)
      .every((g) => isGroupSatisfied(g, selections[g.id] ?? []));
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
      if (isSelected) return { ...current, [group.id]: selected.filter((id) => id !== optionId) };
      if (group.maxSelect !== null && selected.length >= group.maxSelect) return current;
      return { ...current, [group.id]: [...selected, optionId] };
    });
  }

  async function handleAddToCart() {
    if (!item) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addItem({
        menuItemId: item.id,
        quantity,
        notes: notes.trim() || undefined,
        modifierOptionIds: Object.values(selections).flat(),
      });
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem?.detail ?? err.message)
          : t("common.somethingWentWrong"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !item) {
    return <View style={[styles.container, { backgroundColor: theme.surface }]} />;
  }

  const primaryImage = item.images.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const name = localizedText(item.nameEn, item.nameAm, locale);
  const description = localizedText(item.descriptionEn ?? "", item.descriptionAm, locale);

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={styles.container}>
      <View style={[styles.imageWrap, { backgroundColor: theme.tintGreen }]}>
        {primaryImage ? <Image source={{ uri: primaryImage.url }} style={styles.image} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite(item.id) ? t("catalog.favoriteRemove") : t("catalog.favoriteAdd")
          }
          onPress={() => toggleFavorite(item.id)}
          style={[styles.favoriteButton, { backgroundColor: `${theme.surfaceAlt}E6` }]}
        >
          <Text style={{ fontSize: 20 }}>{isFavorite(item.id) ? "♥" : "♡"}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { color: theme.fg }]}>{name}</Text>
        {description ? (
          <Text style={{ color: theme.fgMuted, fontSize: 15 }}>{description}</Text>
        ) : null}

        <View style={styles.priceRow}>
          <PriceTag
            amount={unitPrice}
            locale={locale}
            style={{ fontSize: 22, fontWeight: "700" }}
          />
          {item.calories ? (
            <Text style={{ color: theme.fgMuted }}>
              {t("catalog.calories", { count: item.calories })}
            </Text>
          ) : null}
        </View>

        {item.modifierGroups.map((group) => {
          const selected = selections[group.id] ?? [];
          return (
            <View key={group.id} style={[styles.groupBox, { borderColor: theme.border }]}>
              <Text style={[styles.groupTitle, { color: theme.fg }]}>
                {localizedText(group.nameEn, group.nameAm, locale)}{" "}
                <Text
                  style={{
                    fontSize: 12,
                    color: group.isRequired ? theme.accentText : theme.fgMuted,
                  }}
                >
                  {group.isRequired
                    ? t("catalog.modifierRequired", { min: group.minSelect })
                    : t("catalog.modifierOptional")}
                </Text>
              </Text>
              {group.options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole={group.selectionType === "SINGLE" ? "radio" : "checkbox"}
                    accessibilityState={{ checked }}
                    onPress={() => toggleOption(group, option.id)}
                    style={styles.optionRow}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          group.selectionType === "SINGLE" ? styles.radio : styles.checkbox,
                          {
                            borderColor: theme.border,
                            backgroundColor: checked ? theme.accentText : "transparent",
                          },
                        ]}
                      />
                      <Text style={{ color: theme.fg }}>
                        {localizedText(option.nameEn, option.nameAm, locale)}
                      </Text>
                    </View>
                    {option.priceDelta !== 0 ? (
                      <PriceTag
                        amount={option.priceDelta}
                        locale={locale}
                        style={{ fontSize: 12, color: theme.fgMuted }}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        <QuantityStepper value={quantity} onChange={setQuantity} label={`${name} quantity`} />

        <Input
          label={t("cart.notesLabel")}
          placeholder={t("cart.notesPlaceholder")}
          value={notes}
          onChangeText={setNotes}
          hideLabel
        />

        {error ? <Text style={{ color: theme.dangerText }}>{error}</Text> : null}

        <Button
          loading={submitting}
          disabled={!item.isAvailable || !allRequiredSatisfied}
          onPress={() => void handleAddToCart()}
        >
          {item.isAvailable ? t("catalog.addToCart") : t("catalog.unavailable")}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  imageWrap: { aspectRatio: 4 / 3, width: "100%" },
  image: { width: "100%", height: "100%" },
  favoriteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 16, gap: 16 },
  name: { fontSize: 24, fontWeight: "800" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  groupBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  groupTitle: { fontSize: 15, fontWeight: "700" },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5 },
});
