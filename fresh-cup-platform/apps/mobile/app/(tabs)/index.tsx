import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useTheme } from "../../src/theme/ThemeProvider";

const HIGHLIGHTS = [
  {
    title: "Cold-pressed daily",
    body: "Fresh fruit and vegetables juiced every morning, never from concentrate.",
  },
  {
    title: "Dine in, pickup, or delivery",
    body: "Scan the table QR code, grab it on your way, or have it brought to you.",
  },
  {
    title: "Earn loyalty points",
    body: "Every order adds up — redeem points for free drinks and food.",
  },
];

export default function HomeScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={styles.container}>
      <View style={[styles.hero, { backgroundColor: theme.tintGreen }]}>
        <Text style={[styles.eyebrow, { color: theme.fgMuted }]}>MERKATO, ADDIS ABABA</Text>
        <Text style={[styles.title, { color: theme.fg }]}>Fresh Cup Juice House</Text>
        <Text style={[styles.subtitle, { color: theme.fgMuted }]}>
          Cold-pressed juices, smoothies, and healthy bites — order for dine-in, pickup, or
          delivery.
        </Text>
        <Button onPress={() => router.push("/menu")}>{t("nav.menu")}</Button>
      </View>

      <View style={styles.highlights}>
        {HIGHLIGHTS.map((item) => (
          <Card key={item.title} style={styles.highlightCard}>
            <Text style={[styles.highlightTitle, { color: theme.fg }]}>{item.title}</Text>
            <Text style={[styles.highlightBody, { color: theme.fgMuted }]}>{item.body}</Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32 },
  hero: { alignItems: "center", gap: 12, padding: 24, paddingTop: 48, paddingBottom: 40 },
  eyebrow: { fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  title: { fontSize: 32, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", maxWidth: 320 },
  highlights: { padding: 16, gap: 12 },
  highlightCard: { gap: 4 },
  highlightTitle: { fontSize: 17, fontWeight: "700" },
  highlightBody: { fontSize: 14 },
});
