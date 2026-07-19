import type { OrderStatus } from "@fresh-cup/types";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

const STATUS_TONE: Record<OrderStatus, "neutral" | "green" | "orange" | "error"> = {
  PENDING_PAYMENT: "neutral",
  CONFIRMED: "orange",
  PREPARING: "orange",
  READY: "green",
  OUT_FOR_DELIVERY: "orange",
  DELIVERED: "green",
  COMPLETED: "green",
  CANCELLED: "error",
};

export interface StatusBadgeProps {
  status: OrderStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const { theme } = useTheme();
  const tone = STATUS_TONE[status];
  const backgroundColor =
    tone === "green"
      ? theme.tintGreen
      : tone === "orange"
        ? theme.tintOrange
        : tone === "error"
          ? `${theme.dangerText}26`
          : theme.border;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.label, { color: theme.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  label: { fontSize: 12, fontWeight: "600" },
});
