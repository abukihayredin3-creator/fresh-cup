"use client";

import type { Locale } from "@fresh-cup/types";
import { ACTIVE_ORDER_STATUSES } from "@fresh-cup/types";
import { Card, EmptyState, PriceTag, Skeleton, StatusBadge } from "@fresh-cup/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-ET", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export default function OrdersPage() {
  // next-intl's useLocale() isn't narrowed to our locale union without global module
  // augmentation; routing.ts already constrains it to `locales`.
  const locale = useLocale() as Locale;
  const t = useTranslations("orders");
  const nav = useTranslations("nav");
  const { user, isReady } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.orders.list({ limit: 20 }),
    enabled: Boolean(user),
  });

  if (isReady && !user) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6">
        <EmptyState
          title={t("empty")}
          action={
            <Link
              href="/login?returnTo=%2Forders"
              className="inline-flex items-center justify-center rounded bg-orange-600 px-4 py-2 text-body font-medium text-white hover:bg-orange-600/90"
            >
              {nav("login")}
            </Link>
          }
        />
      </div>
    );
  }

  if (isLoading || !isReady) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="mb-4 h-8 w-40" />
        <Skeleton className="mb-3 h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const orders = data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-h3 text-green-900 dark:text-green-700">{t("title")}</h1>

      {orders.length === 0 ? (
        <EmptyState
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Link
              href="/menu"
              className="inline-flex items-center justify-center rounded bg-orange-600 px-4 py-2 text-body font-medium text-white hover:bg-orange-600/90"
            >
              {nav("menu")}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="block focus-visible:outline-none">
                <Card
                  padded
                  className="transition-colors hover:bg-tint-green focus-visible:ring-2 focus-visible:ring-orange-600"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-display text-h5 text-fg">
                      {t("orderNumber", { id: order.id.slice(0, 8) })}
                    </p>
                    <StatusBadge status={order.status} label={t(`status.${order.status}`)} />
                  </div>
                  <p className="mt-1 text-caption text-fg-muted">
                    {t("placedAt", { date: formatDate(order.placedAt, locale) })}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <PriceTag
                      amount={order.total}
                      locale={locale}
                      className="text-body font-medium text-fg"
                    />
                    <span className="text-body-sm font-medium text-orange-600">
                      {ACTIVE_ORDER_STATUSES.includes(order.status)
                        ? t("trackOrder")
                        : t("viewOrder")}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
