"use client";

import type { Locale } from "@fresh-cup/types";
import {
  Button,
  Dialog,
  EmptyState,
  IconButton,
  PriceTag,
  QuantityStepper,
  Skeleton,
  useToast,
} from "@fresh-cup/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { RecommendationRow } from "@/components/RecommendationRow";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useCartRecommendations } from "@/lib/use-recommendations";

export default function CartPage() {
  // next-intl's useLocale() isn't narrowed to our locale union without global module
  // augmentation; routing.ts already constrains it to `locales`.
  const locale = useLocale() as Locale;
  const t = useTranslations("cart");
  const common = useTranslations("common");
  const nav = useTranslations("nav");
  const router = useRouter();
  const { user, isReady } = useAuth();
  const { cart, isLoading, updateItem, removeItem, clear, isMutating } = useCart();
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const cartMenuItemIds = useMemo(() => cart?.items.map((item) => item.menuItemId) ?? [], [cart]);
  const { data: crossSell } = useCartRecommendations(cartMenuItemIds);

  if (isReady && !user) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6">
        <EmptyState
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Link
              href="/login?returnTo=%2Fcart"
              className="inline-flex items-center justify-center rounded bg-orange-600 px-4 py-2 text-body font-medium text-neutral-900 hover:bg-orange-600/90"
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
        <Skeleton className="mb-3 h-24 w-full" />
        <Skeleton className="mb-3 h-24 w-full" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6">
        <EmptyState
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Link
              href="/menu"
              className="inline-flex items-center justify-center rounded bg-orange-600 px-4 py-2 text-body font-medium text-neutral-900 hover:bg-orange-600/90"
            >
              {t("browseMenu")}
            </Link>
          }
        />
      </div>
    );
  }

  async function handleQuantityChange(itemId: string, quantity: number) {
    try {
      await updateItem(itemId, quantity);
    } catch {
      toast.show({ title: common("somethingWentWrong"), tone: "error" });
    }
  }

  async function handleRemove(itemId: string) {
    try {
      await removeItem(itemId);
    } catch {
      toast.show({ title: common("somethingWentWrong"), tone: "error" });
    }
  }

  async function handleClearConfirmed() {
    setConfirmClear(false);
    try {
      await clear();
    } catch {
      toast.show({ title: common("somethingWentWrong"), tone: "error" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-h3 text-fg">{t("title")}</h1>

      <ul className="flex flex-col gap-4">
        {cart.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface-alt p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex-1">
              <p className="font-display text-h5 text-fg">{item.nameEn}</p>
              {item.modifiers.length > 0 ? (
                <p className="mt-1 text-caption text-fg-muted">
                  {item.modifiers.map((modifier) => modifier.nameEn).join(", ")}
                </p>
              ) : null}
              {item.notes ? <p className="mt-1 text-caption text-fg-muted">{item.notes}</p> : null}
              <PriceTag
                amount={item.unitPrice}
                locale={locale}
                className="mt-1 block text-body-sm text-fg-muted"
              />
            </div>

            <div className="flex items-center gap-3">
              <QuantityStepper
                value={item.quantity}
                onChange={(value) => void handleQuantityChange(item.id, value)}
                disabled={isMutating}
                label={`${item.nameEn} ${t("quantity")}`}
              />
              <PriceTag
                amount={item.lineTotal}
                locale={locale}
                className="w-20 text-right text-body font-medium text-fg"
              />
              <IconButton
                aria-label={common("remove")}
                onClick={() => void handleRemove(item.id)}
                disabled={isMutating}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
                  </g>
                </svg>
              </IconButton>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <RecommendationRow
          title={t("customersAlsoOrdered")}
          items={crossSell?.items ?? []}
          locale={locale}
        />
      </div>

      <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex items-center justify-between text-h5 font-medium text-fg">
          <span>{t("subtotal")}</span>
          <PriceTag amount={cart.subtotal} locale={locale} />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setConfirmClear(true)} disabled={isMutating}>
            {t("clearCart")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push("/checkout")}
            disabled={isMutating}
          >
            {t("checkout")}
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t("clearCart")}
        closeLabel={common("close")}
      >
        <p className="mb-4 text-body-sm text-fg-muted">{t("clearCartConfirm")}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmClear(false)}>
            {common("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void handleClearConfirmed()}>
            {t("clearCart")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
