import type { Locale } from "@fresh-cup/types";

/** Falls back to the English field when an Amharic translation hasn't been entered. */
export function localizedText(en: string, am: string | null, locale: Locale): string {
  return locale === "am" && am ? am : en;
}
