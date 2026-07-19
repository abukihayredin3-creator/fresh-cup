"use client";

import { Avatar, IconButton } from "@fresh-cup/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/menu", key: "menu" },
  { href: "/orders", key: "orders" },
  { href: "/favorites", key: "favorites" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemCount = cart?.itemCount ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-h5 text-green-900 dark:text-green-700"
        >
          Fresh Cup
        </Link>

        <nav aria-label={t("menu")} className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded px-3 py-2 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                  active ? "text-green-900 dark:text-green-700" : "text-fg-muted hover:text-fg"
                }`}
              >
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link
            href="/cart"
            className="relative rounded px-3 py-2 text-body-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
          >
            {t("cart")}
            {itemCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-orange-600 px-1 text-[10px] font-semibold text-white"
              >
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            ) : null}
          </Link>
          {user ? (
            <Link
              href="/profile"
              aria-label={t("profile")}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
            >
              <Avatar name={user.fullName} size="sm" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded px-3 py-2 text-body-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 sm:inline-flex"
            >
              {t("login")}
            </Link>
          )}
          {user ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="hidden rounded px-3 py-2 text-body-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 sm:inline-flex"
            >
              {t("logout")}
            </button>
          ) : null}

          <IconButton
            aria-label={t("menu")}
            aria-expanded={mobileOpen}
            className="md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </g>
            </svg>
          </IconButton>
        </div>
      </div>

      {mobileOpen ? (
        <nav aria-label={t("menu")} className="border-t border-border px-4 py-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded px-3 py-2 text-body-sm font-medium text-fg hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            {user ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void logout();
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-body-sm font-medium text-fg hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                >
                  {t("logout")}
                </button>
              </li>
            ) : (
              <li>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded px-3 py-2 text-body-sm font-medium text-fg hover:bg-tint-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                >
                  {t("login")}
                </Link>
              </li>
            )}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
