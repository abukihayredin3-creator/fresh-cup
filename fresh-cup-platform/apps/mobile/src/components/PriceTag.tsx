import type { Locale, Money } from "@fresh-cup/types";
import { formatMoney } from "@fresh-cup/utils";
import { Text, type TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export interface PriceTagProps {
  /** ETB minor units. */
  amount: number;
  locale?: Locale;
  style?: TextStyle;
  strike?: boolean;
}

export function PriceTag({ amount, locale = "en", style, strike = false }: PriceTagProps) {
  const { theme } = useTheme();
  const money: Money = { amount, currency: "ETB" };
  return (
    <Text
      style={[
        { color: theme.fg },
        strike ? { color: theme.fgMuted, textDecorationLine: "line-through" } : null,
        style,
      ]}
    >
      {formatMoney(money, locale)}
    </Text>
  );
}
