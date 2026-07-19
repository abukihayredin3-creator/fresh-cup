import { ApiClient, type ApiClientOptions } from "./client";
import { AddressesResource } from "./resources/addresses";
import { AdminAnalyticsResource } from "./resources/admin/analytics";
import { AdminAuditResource } from "./resources/admin/audit";
import { AdminBranchesResource } from "./resources/admin/branches";
import { AdminDeliveryResource } from "./resources/admin/delivery";
import { AdminEmployeesResource } from "./resources/admin/employees";
import { AdminIntelligenceResource } from "./resources/admin/intelligence";
import { AdminInventoryResource } from "./resources/admin/inventory";
import { AdminKitchenResource } from "./resources/admin/kitchen";
import { AdminMarketingResource } from "./resources/admin/marketing";
import { AdminMenuResource } from "./resources/admin/menu";
import { AdminPurchasingResource } from "./resources/admin/purchasing";
import { AdminReviewsResource } from "./resources/admin/reviews";
import { AdminSettingsResource } from "./resources/admin/settings";
import { AdminUsersResource } from "./resources/admin/users";
import { SecurityResource } from "./resources/admin/security";
import { AuthResource } from "./resources/auth";
import { CartResource } from "./resources/cart";
import { CatalogResource } from "./resources/catalog";
import { CouponsResource } from "./resources/coupons";
import { LoyaltyResource } from "./resources/loyalty";
import { NotificationsResource } from "./resources/notifications";
import { OrdersResource } from "./resources/orders";
import { PaymentsResource } from "./resources/payments";
import { RecommendationsResource } from "./resources/recommendations";
import { TablesResource } from "./resources/tables";
import { UsersResource } from "./resources/users";

export * from "./client";
export * from "./query";
export * from "./resources/addresses";
export * from "./resources/admin/analytics";
export * from "./resources/admin/audit";
export * from "./resources/admin/branches";
export * from "./resources/admin/delivery";
export * from "./resources/admin/employees";
export * from "./resources/admin/intelligence";
export * from "./resources/admin/inventory";
export * from "./resources/admin/kitchen";
export * from "./resources/admin/marketing";
export * from "./resources/admin/menu";
export * from "./resources/admin/purchasing";
export * from "./resources/admin/reviews";
export * from "./resources/admin/security";
export * from "./resources/admin/settings";
export * from "./resources/admin/users";
export * from "./resources/auth";
export * from "./resources/cart";
export * from "./resources/catalog";
export * from "./resources/coupons";
export * from "./resources/loyalty";
export * from "./resources/notifications";
export * from "./resources/orders";
export * from "./resources/payments";
export * from "./resources/recommendations";
export * from "./resources/tables";
export * from "./resources/users";

/**
 * Admin-platform resources (Phase 5). Grouped under `admin`/`security` to
 * keep the customer-facing surface above uncluttered — every one of these
 * calls an `admin/*` (or account-security) backend route.
 */
export interface FreshCupAdminApiClient {
  settings: AdminSettingsResource;
  audit: AdminAuditResource;
  branches: AdminBranchesResource;
  users: AdminUsersResource;
  employees: AdminEmployeesResource;
  menu: AdminMenuResource;
  inventory: AdminInventoryResource;
  purchasing: AdminPurchasingResource;
  kitchen: AdminKitchenResource;
  delivery: AdminDeliveryResource;
  analytics: AdminAnalyticsResource;
  marketing: AdminMarketingResource;
  reviews: AdminReviewsResource;
  intelligence: AdminIntelligenceResource;
}

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
  tables: TablesResource;
  security: SecurityResource;
  recommendations: RecommendationsResource;
  admin: FreshCupAdminApiClient;
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
    tables: new TablesResource(raw),
    security: new SecurityResource(raw),
    recommendations: new RecommendationsResource(raw),
    admin: {
      settings: new AdminSettingsResource(raw),
      audit: new AdminAuditResource(raw),
      branches: new AdminBranchesResource(raw),
      users: new AdminUsersResource(raw),
      employees: new AdminEmployeesResource(raw),
      menu: new AdminMenuResource(raw),
      inventory: new AdminInventoryResource(raw),
      purchasing: new AdminPurchasingResource(raw),
      kitchen: new AdminKitchenResource(raw),
      delivery: new AdminDeliveryResource(raw),
      analytics: new AdminAnalyticsResource(raw),
      marketing: new AdminMarketingResource(raw),
      reviews: new AdminReviewsResource(raw),
      intelligence: new AdminIntelligenceResource(raw),
    },
  };
}
