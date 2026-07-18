import { StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";

export default function Home() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Merkato, Addis Ababa</Text>
        <Text style={styles.title}>Fresh Cup Juice House</Text>
        <Text style={styles.body}>
          The mobile ordering experience is under construction. This is the Phase 0 project
          foundation — full ordering lands in Phase 5.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warmWhite,
    padding: 24,
  },
  card: {
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 16,
    padding: 24,
    backgroundColor: colors.warmWhite,
    alignItems: "center",
  },
  eyebrow: {
    color: colors.green700,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: colors.green900,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    color: colors.neutral500,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});
