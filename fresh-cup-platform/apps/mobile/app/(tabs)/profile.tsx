import { ApiError } from "@fresh-cup/api-client";
import type { Locale } from "@fresh-cup/types";
import { localeLabels, locales } from "@fresh-cup/i18n";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { PriceTag } from "../../src/components/PriceTag";
import { useI18n } from "../../src/i18n/I18nProvider";
import { api } from "../../src/lib/api-client";
import { useAuth } from "../../src/lib/auth-context";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const { user, isReady, logout, setUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [preferredLocale, setPreferredLocale] = useState<Locale>("en");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Seeds the editable form from AuthProvider's user, which itself only resolves post-mount
    // (from AsyncStorage/a refresh call) — there's no synchronous value to derive this from.
    if (!user) return;
    // eslint-disable-next-line -- see comment above
    setFullName(user.fullName);
    setEmail(user.email ?? "");
    setPreferredLocale(user.locale);
  }, [user]);

  const { data: loyalty } = useQuery({
    queryKey: ["loyalty"],
    queryFn: () => api.loyalty.me({ limit: 5 }),
    enabled: Boolean(user),
  });

  if (!isReady) return null;

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.fg }]}>{t("profile.title")}</Text>
        <Button onPress={() => router.push("/login")}>{t("nav.login")}</Button>
      </View>
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.users.updateMe({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        locale: preferredLocale,
      });
      setUser(updated);
      setMessage(t("profile.profileUpdated"));
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? (error.problem?.detail ?? error.message)
          : t("common.somethingWentWrong"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.fg }]}>{t("profile.title")}</Text>
      {user.phone ? (
        <Text style={{ color: theme.fgMuted, marginBottom: 16 }}>{user.phone}</Text>
      ) : null}

      <Card style={styles.formCard}>
        <Input label={t("profile.fullNameLabel")} value={fullName} onChangeText={setFullName} />
        <Input
          label={t("profile.emailLabel")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: theme.fg }]}>{t("profile.localeLabel")}</Text>
        <View style={styles.localeRow}>
          {locales.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected: preferredLocale === code }}
              onPress={() => setPreferredLocale(code)}
              style={[
                styles.localePill,
                { backgroundColor: preferredLocale === code ? brand.green900 : theme.tintGreen },
              ]}
            >
              <Text
                style={{
                  color: preferredLocale === code ? brand.warmWhite : theme.fg,
                  fontWeight: "600",
                }}
              >
                {localeLabels[code]}
              </Text>
            </Pressable>
          ))}
        </View>

        {message ? <Text style={{ color: theme.successText, fontSize: 13 }}>{message}</Text> : null}
        <Button loading={saving} onPress={() => void handleSave()}>
          {t("profile.saveChanges")}
        </Button>
      </Card>

      {loyalty ? (
        <Card style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <Text style={[styles.sectionTitle, { color: theme.fg }]}>
              {t("profile.loyaltyBalance")}
            </Text>
            <PriceTag
              amount={loyalty.balance}
              locale={locale}
              style={{ fontSize: 18, fontWeight: "700", color: theme.accentText }}
            />
          </View>
        </Card>
      ) : null}

      <Pressable
        onPress={() => router.push("/profile/addresses")}
        style={[styles.navRow, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
      >
        <Text style={{ color: theme.fg, fontWeight: "600" }}>{t("profile.addresses")}</Text>
      </Pressable>

      <View style={styles.languageSwitcher}>
        <Text style={{ color: theme.fgMuted, fontSize: 13 }}>{t("common.language")}:</Text>
        {locales.map((code) => (
          <Pressable key={code} onPress={() => setLocale(code)}>
            <Text
              style={{
                color: locale === code ? theme.accentText : theme.fgMuted,
                fontWeight: "600",
              }}
            >
              {localeLabels[code]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button variant="ghost" onPress={() => void logout()}>
        {t("nav.logout")}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 16 },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: "800" },
  formCard: { gap: 12 },
  label: { fontSize: 14, fontWeight: "500" },
  localeRow: { flexDirection: "row", gap: 8 },
  localePill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  loyaltyCard: { gap: 8 },
  loyaltyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  navRow: { borderWidth: 1, borderRadius: 12, padding: 14 },
  languageSwitcher: { flexDirection: "row", alignItems: "center", gap: 12 },
});
