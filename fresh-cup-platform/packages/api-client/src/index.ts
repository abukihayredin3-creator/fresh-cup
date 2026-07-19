import { ApiClient, type ApiClientOptions } from "./client";
import { AddressesResource } from "./resources/addresses";
import { AuthResource } from "./resources/auth";
import { CartResource } from "./resources/cart";
import { CatalogResource } from "./resources/catalog";
import { CouponsResource } from "./resources/coupons";
import { LoyaltyResource } from "./resources/loyalty";
import { NotificationsResource } from "./resources/notifications";
import { OrdersResource } from "./resources/orders";
import { PaymentsResource } from "./resources/payments";
import { UsersResource } from "./resources/users";

export * from "./client";
export * from "./query";
export * from "./resources/addresses";
export * from "./resources/auth";
export * from "./resources/cart";
export * from "./resources/catalog";
export * from "./resources/coupons";
export * from "./resources/loyalty";
export * from "./resources/notifications";
export * from "./resources/orders";
export * from "./resources/payments";
export * from "./resources/users";

export interface FreshCupApiClient {
  raw: ApiClient;
  auth: AuthResource;
  users: UsersResource;
  addresses: AddressesResource;
  catalog: CatalogResource;
  cart: CartResource;
  orders: OrdersResource;
  payments: PaymentsResource;
  coupons: CouponsResource;
  loyalty: LoyaltyResource;
  notifications: NotificationsResource;
}

/** One client instance per app — pass the same `getAccessToken` every consumer uses for auth. */
export function createFreshCupClient(options: ApiClientOptions): FreshCupApiClient {
  const raw = new ApiClient(options);
  return {
    raw,
    auth: new AuthResource(raw),
    users: new UsersResource(raw),
    addresses: new AddressesResource(raw),
    catalog: new CatalogResource(raw),
    cart: new CartResource(raw),
    orders: new OrdersResource(raw),
    payments: new PaymentsResource(raw),
    coupons: new CouponsResource(raw),
    loyalty: new LoyaltyResource(raw),
    notifications: new NotificationsResource(raw),
  };
}
