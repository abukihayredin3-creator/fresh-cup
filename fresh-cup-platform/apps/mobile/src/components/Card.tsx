import { StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export function Card({ style, ...props }: ViewProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[styles.base, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
});
