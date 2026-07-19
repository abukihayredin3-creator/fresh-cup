import { ApiError } from "@fresh-cup/api-client";
import { ACTIVE_ORDER_STATUSES, type OrderStatus } from "@fresh-cup/types";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { PriceTag } from "../../src/components/PriceTag";
import { StatusBadge } from "../../src/components/StatusBadge";
import { useI18n } from "../../src/i18n/I18nProvider";
import { api } from "../../src/lib/api-client";
import { useOrderTracking } from "../../src/lib/use-order-tracking";
import { useTheme } from "../../src/theme/ThemeProvider";

const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED"];

function formatDateTime(iso: string, locale: "en" | "am"): string {
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useOrderTracking(orderId);

  const {
    data: order,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.orders.get(orderId),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["order-timeline", orderId],
    queryFn: () => api.orders.getTimeline(orderId),
  });

  if (isLoading || !order) {
    return <View style={[styles.container, { backgroundColor: theme.surface }]} />;
  }

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      await api.orders.cancel(orderId);
      await refetch();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem?.detail ?? err.message)
          : t("common.somethingWentWrong"),
      );
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const isActive = ACTIVE_ORDER_STATUSES.includes(order.status);

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.orderNumber, { color: theme.fg }]}>
          {t("orders.orderNumber", { id: order.id.slice(0, 8) })}
        </Text>
        <StatusBadge status={order.status} label={t(`orders.status.${order.status}` as never)} />
      </View>
      <Text style={{ color: theme.fgMuted, marginBottom: 16 }}>
        {t("orders.placedAt", { date: formatDateTime(order.placedAt, locale) })}
      </Text>

      {isActive ? (
        <Card style={styles.timelineCard}>
          <Text style={[styles.sectionTitle, { color: theme.fg }]}>{t("orders.timeline")}</Text>
          {timeline.map((entry) => (
            <View key={entry.id} style={styles.timelineRow}>
              <Text style={{ color: theme.fg }}>
                {t(`orders.status.${entry.toStatus}` as never)}
              </Text>
              <Text style={{ color: theme.fgMuted, fontSize: 12 }}>
                {formatDateTime(entry.createdAt, locale)}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.itemsCard}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.fg, fontWeight: "600" }}>
                {item.quantity}&times; {item.nameSnapshot}
              </Text>
              {item.modifiers.length > 0 ? (
                <Text style={{ color: theme.fgMuted, fontSize: 12 }}>
                  {item.modifiers.map((m) => m.nameSnapshot).join(", ")}
                </Text>
              ) : null}
            </View>
            <PriceTag amount={item.lineTotal} locale={locale} />
          </View>
        ))}
        <View style={[styles.totalsBlock, { borderTopColor: theme.border }]}>
          <View style={styles.totalRow}>
            <Text style={{ color: theme.fgMuted }}>{t("checkout.subtotal")}</Text>
            <PriceTag amount={order.subtotal} locale={locale} />
          </View>
          {order.discountTotal > 0 ? (
            <View style={styles.totalRow}>
              <Text style={{ color: theme.fgMuted }}>{t("checkout.discount")}</Text>
              <PriceTag amount={-order.discountTotal} locale={locale} />
            </View>
          ) : null}
          {order.deliveryFee > 0 ? (
            <View style={styles.totalRow}>
              <Text style={{ color: theme.fgMuted }}>{t("checkout.deliveryFee")}</Text>
              <PriceTag amount={order.deliveryFee} locale={locale} />
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={{ color: theme.fg, fontWeight: "700" }}>{t("checkout.total")}</Text>
            <PriceTag amount={order.total} locale={locale} style={{ fontWeight: "700" }} />
          </View>
        </View>
      </Card>

      {error ? <Text style={{ color: theme.dangerText, marginBottom: 8 }}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button variant="ghost" onPress={() => router.back()}>
          {t("common.back")}
        </Button>
        {canCancel ? (
          <Button variant="danger" loading={cancelling} onPress={() => void handleCancel()}>
            {t("orders.cancelOrder")}
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderNumber: { fontSize: 20, fontWeight: "800" },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  timelineCard: { marginBottom: 16, gap: 6 },
  timelineRow: { flexDirection: "row", justifyContent: "space-between" },
  itemsCard: { gap: 10, marginBottom: 16 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  totalsBlock: { borderTopWidth: 1, paddingTop: 8, gap: 4, marginTop: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  actions: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
});
