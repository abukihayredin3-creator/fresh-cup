import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations("common");
  return (
    <a href="#main-content" className="sr-only-focusable rounded bg-green-900 text-warm-white">
      {t("skipToContent")}
    </a>
  );
}
