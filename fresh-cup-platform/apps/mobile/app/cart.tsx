import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { EmptyState } from "../src/components/EmptyState";
import { PriceTag } from "../src/components/PriceTag";
import { QuantityStepper } from "../src/components/QuantityStepper";
import { useI18n } from "../src/i18n/I18nProvider";
import { useAuth } from "../src/lib/auth-context";
import { useCart } from "../src/lib/cart-context";
import { useTheme } from "../src/theme/ThemeProvider";

export default function CartScreen() {
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user, isReady } = useAuth();
  const { cart, isLoading, updateItem, removeItem, clear, isMutating } = useCart();
  const [confirmClear, setConfirmClear] = useState(false);

  if (isReady && !user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <EmptyState
          title={t("cart.empty")}
          action={<Button onPress={() => router.push("/login")}>{t("nav.login")}</Button>}
        />
      </View>
    );
  }

  if (isLoading || !isReady) {
    return <View style={[styles.container, { backgroundColor: theme.surface }]} />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <EmptyState
          title={t("cart.empty")}
          description={t("cart.emptyHint")}
          action={<Button onPress={() => router.push("/menu")}>{t("cart.browseMenu")}</Button>}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.itemRow,
              { borderColor: theme.border, backgroundColor: theme.surfaceAlt },
            ]}
          >
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: theme.fg }]}>{item.nameEn}</Text>
              {item.modifiers.length > 0 ? (
                <Text style={{ color: theme.fgMuted, fontSize: 12 }}>
                  {item.modifiers.map((m) => m.nameEn).join(", ")}
                </Text>
              ) : null}
              <PriceTag
                amount={item.unitPrice}
                locale={locale}
                style={{ fontSize: 13, color: theme.fgMuted }}
              />
            </View>
            <View style={styles.itemActions}>
              <QuantityStepper
                value={item.quantity}
                onChange={(value) => void updateItem(item.id, value)}
                disabled={isMutating}
                label={`${item.nameEn} quantity`}
              />
              <PriceTag
                amount={item.lineTotal}
                locale={locale}
                style={{ fontSize: 15, fontWeight: "700" }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.remove")}
                onPress={() => void removeItem(item.id)}
              >
                <Text style={{ color: theme.dangerText }}>{t("common.remove")}</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.subtotalRow}>
              <Text style={{ color: theme.fg, fontSize: 17, fontWeight: "700" }}>
                {t("cart.subtotal")}
              </Text>
              <PriceTag
                amount={cart.subtotal}
                locale={locale}
                style={{ fontSize: 17, fontWeight: "700" }}
              />
            </View>
            {confirmClear ? (
              <View style={styles.confirmRow}>
                <Text style={{ color: theme.fg }}>{t("cart.clearCartConfirm")}</Text>
                <View style={styles.confirmButtons}>
                  <Button variant="ghost" onPress={() => setConfirmClear(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="danger"
                    onPress={() => {
                      setConfirmClear(false);
                      void clear();
                    }}
                  >
                    {t("cart.clearCart")}
                  </Button>
                </View>
              </View>
            ) : (
              <View style={styles.footerButtons}>
                <Button variant="ghost" onPress={() => setConfirmClear(true)}>
                  {t("cart.clearCart")}
                </Button>
                <Button onPress={() => router.push("/checkout")}>{t("cart.checkout")}</Button>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 16, fontWeight: "700" },
  itemActions: { alignItems: "flex-end", gap: 8 },
  footer: { marginTop: 8, gap: 16 },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12 },
  footerButtons: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  confirmRow: { gap: 12 },
  confirmButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
});
