import { ApiError } from "@fresh-cup/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../../src/i18n/I18nProvider";
import { api } from "../../src/lib/api-client";
import { useBranch } from "../../src/lib/branch-context";
import { useDineInTable } from "../../src/lib/table-context";
import { useTheme } from "../../src/theme/ThemeProvider";

export default function TableQrScreen() {
  const { qrToken } = useLocalSearchParams<{ qrToken: string }>();
  const { theme } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { setBranchId } = useBranch();
  const { setTable } = useDineInTable();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.tables
      .resolve(qrToken)
      .then((result) => {
        if (cancelled) return;
        setBranchId(result.branchId);
        setTable({
          tableId: result.tableId,
          tableLabel: result.tableLabel,
          branchId: result.branchId,
        });
        router.replace("/(tabs)/menu");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? (err.problem?.detail ?? err.message)
            : t("common.somethingWentWrong"),
        );
      });
    return () => {
      cancelled = true;
    };
    // Resolving the QR token should only re-run when the token itself changes; router/context
    // setters are stable and re-including them would cause redundant reruns.
    // eslint-disable-next-line -- see comment above
  }, [qrToken]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {error ? (
        <>
          <Text style={[styles.title, { color: theme.fg }]}>{t("common.somethingWentWrong")}</Text>
          <Text style={{ color: theme.fgMuted, textAlign: "center" }}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={theme.fg} />
          <Text style={{ color: theme.fgMuted }}>{t("common.loading")}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  title: { fontSize: 18, fontWeight: "700" },
});
