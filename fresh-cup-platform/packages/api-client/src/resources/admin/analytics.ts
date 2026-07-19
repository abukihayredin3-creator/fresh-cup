import type {
  AuditLog,
  CustomerAnalytics,
  CustomerDetail,
  Dashboard,
  DateRangeParams,
  DeliveryAnalytics,
  DeliveryHeatmap,
  ItemAnalytics,
  KitchenAnalytics,
  ListAuditLogsParams,
  PaginatedResult,
  SalesAnalytics,
  TopListParams,
} from "@fresh-cup/types";
import type { ApiClient } from "../../client";
import { toQueryString, type PaginationParams } from "../../query";

export class AdminAnalyticsResource {
  constructor(private readonly client: ApiClient) {}

  dashboard(branchId?: string): Promise<Dashboard> {
    return this.client.request(`/admin/dashboard${toQueryString({ branchId })}`);
  }

  sales(params: DateRangeParams = {}): Promise<SalesAnalytics> {
    return this.client.request(`/admin/analytics/sales${toQueryString(params)}`);
  }

  items(params: TopListParams = {}): Promise<ItemAnalytics> {
    return this.client.request(`/admin/analytics/items${toQueryString(params)}`);
  }

  customers(params: TopListParams = {}): Promise<CustomerAnalytics> {
    return this.client.request(`/admin/analytics/customers${toQueryString(params)}`);
  }

  customerDetail(id: string): Promise<CustomerDetail> {
    return this.client.request(`/admin/customers/${id}`);
  }

  kitchen(params: DateRangeParams = {}): Promise<KitchenAnalytics> {
    return this.client.request(`/admin/analytics/kitchen${toQueryString(params)}`);
  }

  delivery(params: DateRangeParams = {}): Promise<DeliveryAnalytics> {
    return this.client.request(`/admin/analytics/delivery${toQueryString(params)}`);
  }

  deliveryHeatmap(params: DateRangeParams = {}): Promise<DeliveryHeatmap> {
    return this.client.request(`/admin/analytics/delivery/heatmap${toQueryString(params)}`);
  }

  auditLogs(
    params: PaginationParams & ListAuditLogsParams = {},
  ): Promise<PaginatedResult<AuditLog>> {
    return this.client.request(`/admin/audit-logs${toQueryString(params)}`);
  }
}
