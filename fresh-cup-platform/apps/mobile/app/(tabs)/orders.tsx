import { ACTIVE_ORDER_STATUSES } from "@fresh-cup/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { PriceTag } from "../../src/components/PriceTag";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useI18n } from "../../src/i18n/I18nProvider";
import { api } from "../../src/lib/api-client";
import { useAuth } from "../../src/lib/auth-context";
import { useTheme } from "../../src/theme/ThemeProvider";

function formatDate(iso: string, locale: "en" | "am"): string {
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-ET", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export default function OrdersScreen() {
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user, isReady } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.orders.list({ limit: 20 }),
    enabled: Boolean(user),
  });

  if (isReady && !user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <EmptyState
          title={t("orders.empty")}
          action={<Button onPress={() => router.push("/login")}>{t("nav.login")}</Button>}
        />
      </View>
    );
  }

  const orders = data?.items ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title={t("orders.empty")}
              description={t("orders.emptyHint")}
              action={<Button onPress={() => router.push("/menu")}>{t("nav.menu")}</Button>}
            />
          ) : null
        }
        renderItem={({ item: order }) => (
          <Pressable onPress={() => router.push(`/orders/${order.id}`)}>
            <Card style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={[styles.orderNumber, { color: theme.fg }]}>
                  {t("orders.orderNumber", { id: order.id.slice(0, 8) })}
                </Text>
                <StatusBadge
                  status={order.status}
                  label={t(`orders.status.${order.status}` as never)}
                />
              </View>
              <Text style={{ color: theme.fgMuted, fontSize: 12 }}>
                {t("orders.placedAt", { date: formatDate(order.placedAt, locale) })}
              </Text>
              <View style={styles.orderFooter}>
                <PriceTag
                  amount={order.total}
                  locale={locale}
                  style={{ fontSize: 16, fontWeight: "700" }}
                />
                <Text style={{ color: "#A54716", fontSize: 13, fontWeight: "600" }}>
                  {ACTIVE_ORDER_STATUSES.includes(order.status)
                    ? t("orders.trackOrder")
                    : t("orders.viewOrder")}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  orderCard: { gap: 8, marginBottom: 12 },
  orderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderNumber: { fontSize: 16, fontWeight: "700" },
  orderFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
});
