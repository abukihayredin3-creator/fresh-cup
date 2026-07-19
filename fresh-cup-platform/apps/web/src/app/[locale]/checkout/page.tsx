"use client";

import { ApiError } from "@fresh-cup/api-client";
import type {
  Address,
  CouponValidationResult,
  Locale,
  OrderType,
  PaymentMethod,
} from "@fresh-cup/types";
import { Button, Card, Input, PriceTag, Skeleton, Textarea, useToast } from "@fresh-cup/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useBranch } from "@/lib/branch-context";
import { useCart } from "@/lib/cart-context";
import { useDineInTable } from "@/lib/table-context";

const ORDER_TYPES: OrderType[] = ["DINE_IN", "PICKUP", "DELIVERY"];
const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "TELEBIRR",
  "CBE_BIRR",
  "HELLOCASH",
  "AMOLE",
  "CARD",
];

function orderTypeLabel(
  t: ReturnType<typeof useTranslations<"checkout">>,
  type: OrderType,
): string {
  switch (type) {
    case "DINE_IN":
      return t("orderTypeDineIn");
    case "PICKUP":
      return t("orderTypePickup");
    case "DELIVERY":
      return t("orderTypeDelivery");
  }
}

function paymentMethodLabel(
  t: ReturnType<typeof useTranslations<"checkout">>,
  method: PaymentMethod,
): string {
  switch (method) {
    case "CASH":
      return t("paymentCash");
    case "TELEBIRR":
      return t("paymentTelebirr");
    case "CBE_BIRR":
      return t("paymentCbeBirr");
    case "HELLOCASH":
      return t("paymentHelloCash");
    case "AMOLE":
      return t("paymentAmole");
    case "CARD":
      return t("paymentCard");
  }
}

export default function CheckoutPage() {
  // next-intl's useLocale() isn't narrowed to our locale union without global module
  // augmentation; routing.ts already constrains it to `locales`.
  const locale = useLocale() as Locale;
  const t = useTranslations("checkout");
  const common = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { user, isReady } = useAuth();
  const { branchId } = useBranch();
  const { cart, isLoading: cartLoading } = useCart();
  const { table } = useDineInTable();

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.addresses.list(),
    enabled: Boolean(user),
  });

  const [orderType, setOrderType] = useState<OrderType>("PICKUP");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressText, setNewAddressText] = useState("");
  const [addressSubmitting, setAddressSubmitting] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    // Defaults to dine-in the moment a QR-resolved table shows up (it loads async, from
    // sessionStorage/context, after this component's first render).
    // eslint-disable-next-line -- see comment above
    if (table) setOrderType("DINE_IN");
  }, [table]);

  useEffect(() => {
    // Seeds the default/first address once the list loads (also async) without fighting
    // a user's own selection — guarded by `!addressId`.
    const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
    // eslint-disable-next-line -- see comment above
    if (defaultAddress && !addressId) setAddressId(defaultAddress.id);
  }, [addresses, addressId]);

  const discount = couponResult?.discountAmount ?? 0;
  const estimatedTotal = Math.max((cart?.subtotal ?? 0) - discount, 0);

  const readyToOrder = useMemo(() => {
    if (!cart || cart.items.length === 0) return false;
    if (orderType === "DINE_IN") return Boolean(table);
    if (orderType === "DELIVERY") return Boolean(addressId);
    return true;
  }, [cart, orderType, table, addressId]);

  const shouldRedirectToLogin = isReady && !user;
  const shouldRedirectToCart = !cartLoading && Boolean(cart) && cart?.items.length === 0;

  useEffect(() => {
    if (shouldRedirectToLogin) router.replace("/login?returnTo=%2Fcheckout");
  }, [shouldRedirectToLogin, router]);

  useEffect(() => {
    if (shouldRedirectToCart) router.replace("/cart");
  }, [shouldRedirectToCart, router]);

  if (shouldRedirectToLogin || cartLoading || !cart || shouldRedirectToCart) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="mb-4 h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  async function handleValidateCoupon() {
    if (!couponCode.trim() || !cart) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const result = await api.coupons.validate(couponCode.trim(), cart.subtotal);
      setCouponResult(result);
    } catch {
      setCouponResult(null);
      setCouponError(t("couponInvalid"));
    } finally {
      setCouponChecking(false);
    }
  }

  async function handleAddAddress() {
    if (!newAddressLabel.trim() || !newAddressText.trim()) return;
    setAddressSubmitting(true);
    try {
      const created = await api.addresses.create({
        label: newAddressLabel.trim(),
        freeText: newAddressText.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setAddressId(created.id);
      setAddingAddress(false);
      setNewAddressLabel("");
      setNewAddressText("");
    } catch {
      toast.show({ title: common("somethingWentWrong"), tone: "error" });
    } finally {
      setAddressSubmitting(false);
    }
  }

  async function handlePlaceOrder() {
    if (!branchId || !readyToOrder) return;
    setPlacing(true);
    try {
      const order = await api.orders.checkout(
        {
          branchId,
          orderType,
          tableId: orderType === "DINE_IN" ? (table?.tableId ?? undefined) : undefined,
          addressId: orderType === "DELIVERY" ? (addressId ?? undefined) : undefined,
          couponCode: couponResult?.code,
          notes: notes.trim() || undefined,
        },
        crypto.randomUUID(),
      );

      await queryClient.invalidateQueries({ queryKey: ["cart", branchId] });

      const payment = await api.payments.initiate({ orderId: order.id, method: paymentMethod });
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
        return;
      }

      toast.show({
        title: t("orderConfirmed"),
        description: t("orderConfirmedHint"),
        tone: "success",
      });
      router.push(`/orders/${order.id}`);
    } catch (error) {
      toast.show({
        title:
          error instanceof ApiError
            ? (error.problem?.detail ?? error.message)
            : common("somethingWentWrong"),
        tone: "error",
      });
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-h3 text-fg">{t("title")}</h1>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 text-body-sm font-medium text-fg">{t("orderType")}</h2>
          <div className="flex flex-wrap gap-2">
            {ORDER_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                aria-pressed={orderType === type}
                className={`rounded-pill px-4 py-2 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                  orderType === type
                    ? "bg-green-900 text-warm-white"
                    : "bg-tint-green text-fg hover:bg-border"
                }`}
              >
                {orderTypeLabel(t, type)}
              </button>
            ))}
          </div>

          {orderType === "DINE_IN" ? (
            <p className="mt-3 text-body-sm text-fg-muted">
              {table ? `${t("tableLabel")}: ${table.tableLabel}` : t("tableHint")}
            </p>
          ) : null}

          {orderType === "DELIVERY" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-body-sm font-medium text-fg">{t("addressLabel")}</p>
              {addresses.map((address: Address) => (
                <label
                  key={address.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-tint-green"
                >
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === address.id}
                    onChange={() => setAddressId(address.id)}
                    className="mt-1 h-4 w-4 accent-orange-600"
                  />
                  <span className="flex-1">
                    <span className="block text-body-sm font-medium text-fg">{address.label}</span>
                    <span className="block text-caption text-fg-muted">{address.freeText}</span>
                  </span>
                </label>
              ))}

              {addingAddress ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <Input
                    label={t("addressLabel")}
                    placeholder="Home, Office"
                    value={newAddressLabel}
                    onChange={(event) => setNewAddressLabel(event.target.value)}
                  />
                  <Textarea
                    label={t("addressLabel")}
                    hideLabel
                    placeholder={t("addressLabel")}
                    value={newAddressText}
                    onChange={(event) => setNewAddressText(event.target.value)}
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAddingAddress(false)}>
                      {common("cancel")}
                    </Button>
                    <Button
                      size="sm"
                      loading={addressSubmitting}
                      onClick={() => void handleAddAddress()}
                    >
                      {common("save")}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingAddress(true)}
                  className="text-left text-body-sm font-medium text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
                >
                  {t("addAddress")}
                </button>
              )}
              <p className="text-caption text-fg-muted">{t("deliveryFeeNote")}</p>
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="mb-3 text-body-sm font-medium text-fg">{t("couponLabel")}</h2>
          <div className="flex gap-2">
            <Input
              label={t("couponLabel")}
              hideLabel
              value={couponCode}
              onChange={(event) => {
                setCouponCode(event.target.value);
                setCouponResult(null);
                setCouponError(null);
              }}
              className="flex-1"
            />
            <Button
              variant="secondary"
              loading={couponChecking}
              onClick={() => void handleValidateCoupon()}
            >
              {t("couponApply")}
            </Button>
          </div>
          {couponResult ? (
            <p className="mt-2 text-body-sm text-success-text">{t("couponApplied")}</p>
          ) : null}
          {couponError ? (
            <p className="mt-2 text-body-sm text-danger-text" role="alert">
              {couponError}
            </p>
          ) : null}
        </section>

        <section>
          <Textarea
            label={t("notesLabel")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
          />
        </section>

        <section>
          <h2 className="mb-3 text-body-sm font-medium text-fg">{t("paymentMethod")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                aria-pressed={paymentMethod === method}
                className={`rounded border px-3 py-2 text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                  paymentMethod === method
                    ? "border-orange-600 bg-tint-orange text-fg"
                    : "border-border text-fg hover:bg-tint-green"
                }`}
              >
                {paymentMethodLabel(t, method)}
              </button>
            ))}
          </div>
        </section>

        <Card padded>
          <h2 className="mb-3 font-display text-h5 text-fg">{t("summary")}</h2>
          <div className="flex flex-col gap-2 text-body-sm">
            <div className="flex justify-between">
              <span className="text-fg-muted">{t("subtotal")}</span>
              <PriceTag amount={cart.subtotal} locale={locale} />
            </div>
            {discount > 0 ? (
              <div className="flex justify-between">
                <span className="text-fg-muted">{t("discount")}</span>
                <PriceTag amount={-discount} locale={locale} />
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-body font-medium text-fg">
              <span>{t("total")}</span>
              <PriceTag amount={estimatedTotal} locale={locale} />
            </div>
          </div>
        </Card>

        <Button
          variant="primary"
          size="lg"
          loading={placing}
          disabled={!readyToOrder}
          onClick={() => void handlePlaceOrder()}
        >
          {placing ? t("placingOrder") : t("placeOrder")}
        </Button>
      </div>
    </div>
  );
}
