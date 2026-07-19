"use client";

import { localeLabels, locales } from "@fresh-cup/i18n";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");

  return (
    <label className="flex items-center gap-2 text-body-sm text-fg">
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value });
        }}
        className="rounded border border-border bg-surface-alt px-2 py-1 text-body-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
