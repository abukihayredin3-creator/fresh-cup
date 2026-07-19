import type { Locale } from "@fresh-cup/types";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { brand } from "../theme/tokens";
import { PriceTag } from "./PriceTag";

export interface ProductCardProps {
  name: string;
  description?: string | null;
  priceAmount: number;
  locale?: Locale;
  imageUrl?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteLabel: string;
  onSelect?: () => void;
  addLabel?: string;
  onAdd?: () => void;
  unavailable?: boolean;
  unavailableLabel?: string;
}

export function ProductCard({
  name,
  description,
  priceAmount,
  locale = "en",
  imageUrl,
  isFavorite = false,
  onToggleFavorite,
  favoriteLabel,
  onSelect,
  addLabel,
  onAdd,
  unavailable = false,
  unavailableLabel,
}: ProductCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
      <View style={[styles.imageWrap, { backgroundColor: theme.tintGreen }]}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
        {onToggleFavorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favoriteLabel}
            accessibilityState={{ selected: isFavorite }}
            onPress={onToggleFavorite}
            style={[styles.favoriteButton, { backgroundColor: `${theme.surfaceAlt}E6` }]}
          >
            <Text style={{ color: isFavorite ? brand.orange600 : theme.fg, fontSize: 16 }}>
              {isFavorite ? "♥" : "♡"}
            </Text>
          </Pressable>
        ) : null}
        {unavailable ? (
          <View style={[styles.unavailableOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[styles.unavailablePill, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={{ color: theme.fg, fontSize: 12, fontWeight: "600" }}>
                {unavailableLabel}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <Pressable accessibilityRole="button" onPress={onSelect} style={styles.body}>
        <Text style={[styles.name, { color: theme.fg }]} numberOfLines={1}>
          {name}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: theme.fgMuted }]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </Pressable>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <PriceTag
          amount={priceAmount}
          locale={locale}
          style={{ fontSize: 16, fontWeight: "600" }}
        />
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            disabled={unavailable}
            onPress={onAdd}
            style={[styles.addButton, { opacity: unavailable ? 0.5 : 1 }]}
          >
            <Text style={styles.addLabel}>{addLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden", flex: 1 },
  imageWrap: { aspectRatio: 4 / 3, width: "100%" },
  image: { width: "100%", height: "100%" },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  unavailablePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  body: { padding: 12, gap: 4, flex: 1 },
  name: { fontSize: 16, fontWeight: "700" },
  description: { fontSize: 13 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    padding: 12,
  },
  addButton: {
    backgroundColor: brand.orange600,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addLabel: { color: brand.neutral900, fontSize: 13, fontWeight: "600" },
});
