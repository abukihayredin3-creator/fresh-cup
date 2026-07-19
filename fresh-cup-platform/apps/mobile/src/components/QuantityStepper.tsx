import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  label,
}: QuantityStepperProps) {
  const { theme } = useTheme();
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      style={[styles.container, { borderColor: theme.border }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        disabled={!canDecrement}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={[styles.stepButton, { opacity: canDecrement ? 1 : 0.4 }]}
      >
        <Text style={[styles.stepGlyph, { color: theme.fg }]}>&minus;</Text>
      </Pressable>
      <Text style={[styles.value, { color: theme.fg }]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={!canIncrement}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={[styles.stepButton, { opacity: canIncrement ? 1 : 0.4 }]}
      >
        <Text style={[styles.stepGlyph, { color: theme.fg }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  stepGlyph: { fontSize: 20, lineHeight: 22 },
  value: { fontSize: 16, fontWeight: "600", minWidth: 20, textAlign: "center" },
});
