import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.fg }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.fgMuted }]}>{description}</Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 48, gap: 8 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 14, textAlign: "center", maxWidth: 320 },
  action: { marginTop: 8 },
});
