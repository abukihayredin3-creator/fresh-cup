import type { Locale } from "@fresh-cup/types";
import am from "./locales/am.json";
import en from "./locales/en.json";

export const messages = { en, am } satisfies Record<Locale, unknown>;

export type Messages = typeof en;

export const locales: Locale[] = ["en", "am"];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  am: "አማርኛ",
};

type Path<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Path<T[K]>}`;
    }[keyof T & string]
  : never;

/** Every dot-path key that resolves to a translatable string, e.g. "cart.title". */
export type MessageKey = Path<Messages>;

function resolve(dict: unknown, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/**
 * Minimal, dependency-free translator for apps/mobile (web uses next-intl
 * directly against the same JSON). Supports `{param}` interpolation only —
 * plural forms are two separate keys (`fooOne`/`fooOther`) picked via
 * `pickPlural`, not embedded ICU syntax, so both platforms share one
 * lookup strategy.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = resolve(messages[locale], key) ?? resolve(messages[defaultLocale], key) ?? key;
  return interpolate(template, params);
}

export function pickPlural(count: number, oneKey: MessageKey, otherKey: MessageKey): MessageKey {
  return count === 1 ? oneKey : otherKey;
}
