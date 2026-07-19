import {
  defaultLocale,
  localeLabels,
  locales,
  pickPlural,
  translate,
  type MessageKey,
} from "@fresh-cup/i18n";
import type { Locale } from "@fresh-cup/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  tPlural: (
    count: number,
    oneKey: MessageKey,
    otherKey: MessageKey,
    params?: Record<string, string | number>,
  ) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "fresh-cup-locale";

export { locales, localeLabels };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "en" || stored === "am") {
          setLocaleState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const tPlural = useCallback(
    (
      count: number,
      oneKey: MessageKey,
      otherKey: MessageKey,
      params?: Record<string, string | number>,
    ) => translate(locale, pickPlural(count, oneKey, otherKey), { count, ...params }),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t, tPlural }), [locale, setLocale, t, tPlural]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
