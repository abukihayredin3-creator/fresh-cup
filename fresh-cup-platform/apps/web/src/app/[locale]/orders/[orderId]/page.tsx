"use client";

import { ApiError } from "@fresh-cup/api-client";
import type { Locale, OrderStatus } from "@fresh-cup/types";
import { ACTIVE_ORDER_STATUSES } from "@fresh-cup/types";
import { Button, Card, Dialog, PriceTag, Skeleton, StatusBadge, useToast } from "@fresh-cup/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { use, useState } from "react";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { useOrderTracking } from "@/lib/use-order-tracking";

const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "CONFIRMED"];

function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function OrderTrackingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  // next-intl's useLocale() isn't narrowed to our locale union without global module
  // augmentation; routing.ts already constrains it to `locales`.
  const locale = useLocale() as Locale;
  const t = useTranslations("orders");
  const checkoutT = useTranslations("checkout");
  const common = useTranslations("common");
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useOrderTracking(orderId);

  const {
    data: order,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.orders.get(orderId),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["order-timeline", orderId],
    queryFn: () => api.orders.getTimeline(orderId),
  });

  if (isLoading || !order) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="mb-4 h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  async function handleCancel() {
    setConfirmCancel(false);
    setCancelling(true);
    try {
      await api.orders.cancel(orderId);
      await refetch();
    } catch (error) {
      toast.show({
        title:
          error instanceof ApiError
            ? (error.problem?.detail ?? error.message)
            : common("somethingWentWrong"),
        tone: "error",
      });
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const isActive = ACTIVE_ORDER_STATUSES.includes(order.status);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-h3 text-fg">
          {t("orderNumber", { id: order.id.slice(0, 8) })}
        </h1>
        <StatusBadge status={order.status} label={t(`status.${order.status}`)} />
      </div>

      <p className="mb-6 text-body-sm text-fg-muted">
        {t("placedAt", { date: formatDateTime(order.placedAt, locale) })}
      </p>

      {isActive ? (
        <Card padded className="mb-6">
          <h2 className="mb-3 font-display text-h5 text-fg">{t("timeline")}</h2>
          <ol className="flex flex-col gap-3">
            {timeline.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-body-sm">
                <span className="text-fg">{t(`status.${entry.toStatus}`)}</span>
                <span className="text-caption text-fg-muted">
                  {formatDateTime(entry.createdAt, locale)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <Card padded className="mb-6">
        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 text-body-sm">
              <div>
                <p className="font-medium text-fg">
                  {item.quantity}&times; {item.nameSnapshot}
                </p>
                {item.modifiers.length > 0 ? (
                  <p className="text-caption text-fg-muted">
                    {item.modifiers.map((modifier) => modifier.nameSnapshot).join(", ")}
                  </p>
                ) : null}
              </div>
              <PriceTag amount={item.lineTotal} locale={locale} />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-body-sm">
          <div className="flex justify-between">
            <span className="text-fg-muted">{checkoutT("subtotal")}</span>
            <PriceTag amount={order.subtotal} locale={locale} />
          </div>
          {order.discountTotal > 0 ? (
            <div className="flex justify-between">
              <span className="text-fg-muted">{checkoutT("discount")}</span>
              <PriceTag amount={-order.discountTotal} locale={locale} />
            </div>
          ) : null}
          {order.deliveryFee > 0 ? (
            <div className="flex justify-between">
              <span className="text-fg-muted">{checkoutT("deliveryFee")}</span>
              <PriceTag amount={order.deliveryFee} locale={locale} />
            </div>
          ) : null}
          {order.taxTotal > 0 ? (
            <div className="flex justify-between">
              <span className="text-fg-muted">{checkoutT("tax")}</span>
              <PriceTag amount={order.taxTotal} locale={locale} />
            </div>
          ) : null}
          <div className="mt-1 flex justify-between text-body font-medium text-fg">
            <span>{checkoutT("total")}</span>
            <PriceTag amount={order.total} locale={locale} />
          </div>
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href="/orders"
          className="inline-flex items-center justify-center rounded border border-border px-4 py-2 text-body-sm font-medium text-fg hover:bg-tint-green"
        >
          {common("back")}
        </Link>
        {canCancel ? (
          <Button variant="danger" loading={cancelling} onClick={() => setConfirmCancel(true)}>
            {t("cancelOrder")}
          </Button>
        ) : null}
      </div>

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t("cancelOrder")}
        closeLabel={common("close")}
      >
        <p className="mb-4 text-body-sm text-fg-muted">{t("cancelOrderConfirm")}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
            {common("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void handleCancel()}>
            {t("cancelOrder")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
