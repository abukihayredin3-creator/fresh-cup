import { ApiError } from "@fresh-cup/api-client";
import type { Address } from "@fresh-cup/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Input } from "../../src/components/Input";
import { useI18n } from "../../src/i18n/I18nProvider";
import { api } from "../../src/lib/api-client";
import { useTheme } from "../../src/theme/ThemeProvider";

interface FormState {
  id: string | null;
  label: string;
  freeText: string;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = { id: null, label: "", freeText: "", isDefault: false };

export default function AddressesScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.addresses.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (input: FormState) =>
      input.id
        ? api.addresses.update(input.id, {
            label: input.label,
            freeText: input.freeText,
            isDefault: input.isDefault,
          })
        : api.addresses.create({
            label: input.label,
            freeText: input.freeText,
            isDefault: input.isDefault,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? (err.problem?.detail ?? err.message)
          : t("common.somethingWentWrong"),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.addresses.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        data={addresses}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isLoading ? <EmptyState title={t("addresses.empty")} /> : null}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Button onPress={() => setShowForm((v) => !v)}>{t("addresses.addAddress")}</Button>
          </View>
        }
        renderItem={({ item }: { item: Address }) => (
          <Card style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Text style={{ color: theme.fg, fontWeight: "700" }}>{item.label}</Text>
              {item.isDefault ? (
                <View style={[styles.badge, { backgroundColor: theme.tintGreen }]}>
                  <Text style={{ color: theme.fg, fontSize: 11, fontWeight: "600" }}>
                    {t("addresses.default")}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: theme.fgMuted, fontSize: 13 }}>{item.freeText}</Text>
            <View style={styles.addressActions}>
              <Pressable
                onPress={() => {
                  setForm({
                    id: item.id,
                    label: item.label,
                    freeText: item.freeText,
                    isDefault: item.isDefault,
                  });
                  setShowForm(true);
                }}
              >
                <Text style={{ color: theme.accentText, fontSize: 13, fontWeight: "600" }}>
                  {t("addresses.editAddress")}
                </Text>
              </Pressable>
              <Pressable onPress={() => deleteMutation.mutate(item.id)}>
                <Text style={{ color: theme.dangerText, fontSize: 13, fontWeight: "600" }}>
                  {t("addresses.deleteAddress")}
                </Text>
              </Pressable>
            </View>
          </Card>
        )}
      />

      {showForm ? (
        <Card style={[styles.formCard, { borderColor: theme.border }]}>
          <Input
            label={t("addresses.labelLabel")}
            placeholder={t("addresses.labelPlaceholder")}
            value={form.label}
            onChangeText={(v) => setForm((c) => ({ ...c, label: v }))}
          />
          <Input
            label={t("addresses.freeTextLabel")}
            value={form.freeText}
            onChangeText={(v) => setForm((c) => ({ ...c, freeText: v }))}
            multiline
          />
          <View style={styles.switchRow}>
            <Text style={{ color: theme.fg }}>{t("addresses.setDefault")}</Text>
            <Switch
              value={form.isDefault}
              onValueChange={(v) => setForm((c) => ({ ...c, isDefault: v }))}
            />
          </View>
          {error ? <Text style={{ color: theme.dangerText }}>{error}</Text> : null}
          <View style={styles.formButtons}>
            <Button
              variant="ghost"
              onPress={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={!form.label.trim() || !form.freeText.trim()}
              onPress={() => saveMutation.mutate(form)}
            >
              {t("common.save")}
            </Button>
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  headerRow: { marginBottom: 12, alignItems: "flex-start" },
  addressCard: { gap: 6, marginBottom: 12 },
  addressHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  addressActions: { flexDirection: "row", gap: 16, marginTop: 4 },
  formCard: { margin: 16, marginTop: 0, gap: 12, borderWidth: 1 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
});
