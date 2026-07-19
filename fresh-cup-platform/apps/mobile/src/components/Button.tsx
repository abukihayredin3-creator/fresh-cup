import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { brand } from "../theme/tokens";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  children: string;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === "primary"
      ? brand.orange600
      : variant === "secondary"
        ? brand.green900
        : variant === "danger"
          ? brand.error600
          : "transparent";
  const textColor =
    variant === "primary" ? brand.neutral900 : variant === "ghost" ? theme.fg : brand.warmWhite;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
