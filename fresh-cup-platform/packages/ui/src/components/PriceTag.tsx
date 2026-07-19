import type { Locale, Money } from "@fresh-cup/types";
import { formatMoney } from "@fresh-cup/utils";
import { cn } from "../cn";

export interface PriceTagProps {
  /** ETB minor units. */
  amount: number;
  locale?: Locale;
  className?: string;
  /** Renders with a strikethrough, for showing an original price next to a discounted one. */
  strike?: boolean;
}

export function PriceTag({ amount, locale = "en", className, strike = false }: PriceTagProps) {
  const money: Money = { amount, currency: "ETB" };
  return (
    <span className={cn(strike && "text-fg-muted line-through", className)}>
      {formatMoney(money, locale)}
    </span>
  );
}
