import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { brand } from "../theme/tokens";

export interface InputProps extends TextInputProps {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

export function Input({ label, hideLabel = false, hint, error, style, ...props }: InputProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {!hideLabel ? <Text style={[styles.label, { color: theme.fg }]}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.fgMuted}
        style={[
          styles.input,
          {
            color: theme.fg,
            backgroundColor: theme.surfaceAlt,
            borderColor: error ? brand.error600 : theme.border,
          },
          style,
        ]}
        {...props}
      />
      {hint && !error ? <Text style={[styles.hint, { color: theme.fgMuted }]}>{hint}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: theme.dangerText }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    minHeight: 44,
  },
  hint: { fontSize: 12 },
});
