import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-alt">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-h5 text-green-900 dark:text-green-700">
            {common("appName")}
          </p>
          <p className="mt-1 text-body-sm text-fg-muted">Merkato, Addis Ababa</p>
        </div>
        <nav aria-label={t("menu")} className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/menu" className="text-body-sm text-fg-muted hover:text-fg">
            {t("menu")}
          </Link>
          <Link href="/orders" className="text-body-sm text-fg-muted hover:text-fg">
            {t("orders")}
          </Link>
          <Link href="/favorites" className="text-body-sm text-fg-muted hover:text-fg">
            {t("favorites")}
          </Link>
          <Link href="/profile" className="text-body-sm text-fg-muted hover:text-fg">
            {t("profile")}
          </Link>
        </nav>
        <p className="text-caption text-fg-muted">
          © {year} {common("appName")} Juice House
        </p>
      </div>
    </footer>
  );
}
