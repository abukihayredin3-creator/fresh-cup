import { ApiError } from "@fresh-cup/api-client";
import type { MessageKey } from "@fresh-cup/i18n";
import type { Address, CouponValidationResult, OrderType, PaymentMethod } from "@fresh-cup/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Input } from "../src/components/Input";
import { PriceTag } from "../src/components/PriceTag";
import { useI18n } from "../src/i18n/I18nProvider";
import { api } from "../src/lib/api-client";
import { useAuth } from "../src/lib/auth-context";
import { useBranch } from "../src/lib/branch-context";
import { useCart } from "../src/lib/cart-context";
import { useDineInTable } from "../src/lib/table-context";
import { useTheme } from "../src/theme/ThemeProvider";
import { brand } from "../src/theme/tokens";

const ORDER_TYPES: OrderType[] = ["DINE_IN", "PICKUP", "DELIVERY"];
const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "TELEBIRR",
  "CBE_BIRR",
  "HELLOCASH",
  "AMOLE",
  "CARD",
];

function orderTypeLabel(t: (key: MessageKey) => string, type: OrderType): string {
  if (type === "DINE_IN") return t("checkout.orderTypeDineIn");
  if (type === "PICKUP") return t("checkout.orderTypePickup");
  return t("checkout.orderTypeDelivery");
}

function paymentMethodLabel(t: (key: MessageKey) => string, method: PaymentMethod): string {
  switch (method) {
    case "CASH":
      return t("checkout.paymentCash");
    case "TELEBIRR":
      return t("checkout.paymentTelebirr");
    case "CBE_BIRR":
      return t("checkout.paymentCbeBirr");
    case "HELLOCASH":
      return t("checkout.paymentHelloCash");
    case "AMOLE":
      return t("checkout.paymentAmole");
    case "CARD":
      return t("checkout.paymentCard");
  }
}

export default function CheckoutScreen() {
  const { theme } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { user } = useAuth();
  const { branchId } = useBranch();
  const { cart } = useCart();
  const { table } = useDineInTable();

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.addresses.list(),
    enabled: Boolean(user),
  });

  const [orderType, setOrderType] = useState<OrderType>("PICKUP");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    // Defaults to dine-in the moment a QR-resolved table shows up (it loads async, from
    // AsyncStorage/context, after this component's first render).
    // eslint-disable-next-line -- see comment above
    if (table) setOrderType("DINE_IN");
  }, [table]);

  useEffect(() => {
    // Seeds the default/first address once the list loads (also async) without fighting
    // a user's own selection — guarded by `!addressId`.
    const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
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

  async function handleValidateCoupon() {
    if (!couponCode.trim() || !cart) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const result = await api.coupons.validate(couponCode.trim(), cart.subtotal);
      setCouponResult(result);
    } catch {
      setCouponResult(null);
      setCouponError(t("checkout.couponInvalid"));
    } finally {
      setCouponChecking(false);
    }
  }

  async function handlePlaceOrder() {
    if (!branchId || !readyToOrder) return;
    setPlacing(true);
    setPlaceError(null);
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
        Crypto.randomUUID(),
      );

      await queryClient.invalidateQueries({ queryKey: ["cart", branchId] });

      const payment = await api.payments.initiate({ orderId: order.id, method: paymentMethod });
      if (payment.checkoutUrl) {
        await Linking.openURL(payment.checkoutUrl);
        return;
      }

      router.replace(`/orders/${order.id}`);
    } catch (error) {
      setPlaceError(
        error instanceof ApiError
          ? (error.problem?.detail ?? error.message)
          : t("common.somethingWentWrong"),
      );
    } finally {
      setPlacing(false);
    }
  }

  if (!cart || cart.items.length === 0) {
    return <View style={[styles.container, { backgroundColor: theme.surface }]} />;
  }

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={styles.container}>
      <Text style={[styles.sectionLabel, { color: theme.fg }]}>{t("checkout.orderType")}</Text>
      <View style={styles.pillRow}>
        {ORDER_TYPES.map((type) => {
          const selected = orderType === type;
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setOrderType(type)}
              style={[
                styles.pill,
                { backgroundColor: selected ? brand.green900 : theme.tintGreen },
              ]}
            >
              <Text
                style={{
                  color: selected ? brand.warmWhite : theme.fg,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {orderTypeLabel(t, type)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {orderType === "DINE_IN" ? (
        <Text style={{ color: theme.fgMuted, marginBottom: 16 }}>
          {table ? `${t("checkout.tableLabel")}: ${table.tableLabel}` : t("checkout.tableHint")}
        </Text>
      ) : null}

      {orderType === "DELIVERY" ? (
        <View style={styles.addressList}>
          {addresses.map((address: Address) => {
            const selected = addressId === address.id;
            return (
              <Pressable
                key={address.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setAddressId(address.id)}
                style={[
                  styles.addressRow,
                  { borderColor: selected ? brand.orange600 : theme.border },
                ]}
              >
                <Text style={{ color: theme.fg, fontWeight: "600" }}>{address.label}</Text>
                <Text style={{ color: theme.fgMuted, fontSize: 13 }}>{address.freeText}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => router.push("/profile/addresses")}>
            <Text style={{ color: theme.accentText, fontWeight: "600" }}>
              {t("checkout.addAddress")}
            </Text>
          </Pressable>
          <Text style={{ color: theme.fgMuted, fontSize: 12 }}>
            {t("checkout.deliveryFeeNote")}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.sectionLabel, { color: theme.fg }]}>{t("checkout.couponLabel")}</Text>
      <View style={styles.couponRow}>
        <View style={{ flex: 1 }}>
          <Input
            label={t("checkout.couponLabel")}
            hideLabel
            value={couponCode}
            onChangeText={(value) => {
              setCouponCode(value);
              setCouponResult(null);
              setCouponError(null);
            }}
          />
        </View>
        <Button loading={couponChecking} onPress={() => void handleValidateCoupon()}>
          {t("checkout.couponApply")}
        </Button>
      </View>
      {couponResult ? (
        <Text style={{ color: theme.successText, marginBottom: 8 }}>
          {t("checkout.couponApplied")}
        </Text>
      ) : null}
      {couponError ? (
        <Text style={{ color: theme.dangerText, marginBottom: 8 }}>{couponError}</Text>
      ) : null}

      <View style={styles.notesField}>
        <Input label={t("checkout.notesLabel")} value={notes} onChangeText={setNotes} multiline />
      </View>

      <Text style={[styles.sectionLabel, { color: theme.fg }]}>{t("checkout.paymentMethod")}</Text>
      <View style={styles.paymentGrid}>
        {PAYMENT_METHODS.map((method) => {
          const selected = paymentMethod === method;
          return (
            <Pressable
              key={method}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setPaymentMethod(method)}
              style={[
                styles.paymentPill,
                {
                  borderColor: selected ? brand.orange600 : theme.border,
                  backgroundColor: selected ? theme.tintOrange : "transparent",
                },
              ]}
            >
              <Text style={{ color: theme.fg, fontSize: 13, fontWeight: "600" }}>
                {paymentMethodLabel(t, method)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.summaryCard}>
        <Text style={[styles.sectionLabel, { color: theme.fg }]}>{t("checkout.summary")}</Text>
        <View style={styles.summaryRow}>
          <Text style={{ color: theme.fgMuted }}>{t("checkout.subtotal")}</Text>
          <PriceTag amount={cart.subtotal} locale={locale} />
        </View>
        {discount > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.fgMuted }}>{t("checkout.discount")}</Text>
            <PriceTag amount={-discount} locale={locale} />
          </View>
        ) : null}
        <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: theme.border }]}>
          <Text style={{ color: theme.fg, fontWeight: "700" }}>{t("checkout.total")}</Text>
          <PriceTag amount={estimatedTotal} locale={locale} style={{ fontWeight: "700" }} />
        </View>
      </Card>

      {placeError ? (
        <Text style={{ color: theme.dangerText, marginBottom: 8 }}>{placeError}</Text>
      ) : null}

      <Button loading={placing} disabled={!readyToOrder} onPress={() => void handlePlaceOrder()}>
        {placing ? t("checkout.placingOrder") : t("checkout.placeOrder")}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 4 },
  sectionLabel: { fontSize: 15, fontWeight: "700", marginBottom: 8, marginTop: 8 },
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  addressList: { gap: 8, marginBottom: 16 },
  addressRow: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  couponRow: { flexDirection: "row", gap: 8, alignItems: "flex-end", marginBottom: 8 },
  notesField: { marginVertical: 8 },
  paymentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  paymentPill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  summaryCard: { gap: 8, marginBottom: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryTotal: { borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
});
