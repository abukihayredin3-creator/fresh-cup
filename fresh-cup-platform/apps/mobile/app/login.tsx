import { ApiError } from "@fresh-cup/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Input } from "../src/components/Input";
import { useI18n } from "../src/i18n/I18nProvider";
import { useAuth } from "../src/lib/auth-context";
import { useTheme } from "../src/theme/ThemeProvider";

type Mode = "customer-phone" | "customer-code" | "staff";

export default function LoginScreen() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { requestOtp, verifyOtp, staffLogin } = useAuth();

  const [mode, setMode] = useState<Mode>("customer-phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitRequestOtp() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      setMode("customer-code");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem?.detail ?? err.message)
          : t("common.somethingWentWrong"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitVerifyOtp() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, code);
      router.back();
    } catch {
      setError(t("auth.invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function submitStaffLogin() {
    setError(null);
    setLoading(true);
    try {
      await staffLogin(email, password);
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem?.detail ?? err.message)
          : t("common.somethingWentWrong"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: theme.fg }]}>
          {mode === "staff" ? t("auth.staffTitle") : t("auth.title")}
        </Text>

        {error ? (
          <View
            style={[
              styles.errorBox,
              { borderColor: theme.dangerText, backgroundColor: `${theme.dangerText}1A` },
            ]}
          >
            <Text style={{ color: theme.fg }}>{error}</Text>
          </View>
        ) : null}

        {mode === "customer-phone" ? (
          <View style={styles.form}>
            <Input
              label={t("auth.phoneLabel")}
              hint={t("auth.phoneHint")}
              placeholder="+251 9XX XXX XXX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Button
              loading={loading}
              disabled={phone.trim().length === 0}
              onPress={() => void submitRequestOtp()}
            >
              {t("auth.sendCode")}
            </Button>
          </View>
        ) : null}

        {mode === "customer-code" ? (
          <View style={styles.form}>
            <Input
              label={t("auth.codeLabel")}
              hint={t("auth.codeHint")}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            <Button
              loading={loading}
              disabled={code.trim().length === 0}
              onPress={() => void submitVerifyOtp()}
            >
              {t("auth.verify")}
            </Button>
            <View style={styles.row}>
              <Pressable onPress={() => void submitRequestOtp()}>
                <Text style={{ color: theme.fgMuted }}>{t("auth.resendCode")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode("customer-phone");
                  setCode("");
                  setError(null);
                }}
              >
                <Text style={{ color: theme.fgMuted }}>{t("auth.changePhone")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {mode === "staff" ? (
          <View style={styles.form}>
            <Input
              label={t("auth.emailLabel")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label={t("auth.passwordLabel")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Button loading={loading} onPress={() => void submitStaffLogin()}>
              {t("auth.signIn")}
            </Button>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            setMode(mode === "staff" ? "customer-phone" : "staff");
            setError(null);
          }}
          style={styles.switchModeButton}
        >
          <Text style={{ color: theme.fgMuted, textAlign: "center" }}>
            {mode === "staff" ? t("auth.title") : t("auth.staffLoginLink")}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 420, gap: 16 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  form: { gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 10 },
  switchModeButton: { marginTop: 4 },
});
