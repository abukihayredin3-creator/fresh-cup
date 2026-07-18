import type { Money } from "@fresh-cup/types";

/** Formats integer minor-unit money as a display string, e.g. 4550 -> "ETB 45.50". */
export function formatMoney({ amount, currency }: Money, locale: "en" | "am" = "en"): string {
  const major = amount / 100;
  const formatted = new Intl.NumberFormat(locale === "am" ? "am-ET" : "en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${currency} ${formatted}`;
}
