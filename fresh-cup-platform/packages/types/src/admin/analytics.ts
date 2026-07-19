export interface DateRangeParams {
  branchId?: string;
  from?: string;
  to?: string;
}

export interface TopListParams extends DateRangeParams {
  limit?: number;
}

export interface Dashboard {
  /** ETB minor units. */
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  pendingDeliveries: number;
  lowStockItemCount: number;
  /** ETB minor units, rolling 7-day window ending today. */
  last7DaysRevenue: number;
}

export interface SalesByDay {
  /** YYYY-MM-DD */
  date: string;
  revenue: number;
  orders: number;
}

export interface SalesAnalytics {
  from: string;
  to: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  byDay: SalesByDay[];
}

export interface ItemAnalyticsEntry {
  menuItemId: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

export interface ItemAnalytics {
  items: ItemAnalyticsEntry[];
}

export interface CustomerAnalyticsEntry {
  userId: string;
  fullName: string;
  ordersCount: number;
  totalSpend: number;
}

export interface CustomerAnalytics {
  customers: CustomerAnalyticsEntry[];
}

export interface CustomerDetail {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  createdAt: string;
  ordersCount: number;
  totalSpend: number;
  loyaltyBalance: number;
  lastOrderAt: string | null;
}

export interface KitchenStationStat {
  stationId: string;
  stationName: string;
  itemCount: number;
  avgEstimatedPrepSeconds: number;
}

export interface KitchenAnalytics {
  from: string;
  to: string;
  completedOrders: number;
  avgPrepSeconds: number | null;
  byStation: KitchenStationStat[];
}

export interface DeliveryZoneStat {
  zoneId: string | null;
  zoneName: string;
  deliveredCount: number;
  avgFee: number;
}

export interface DeliveryAnalytics {
  from: string;
  to: string;
  totalDeliveries: number;
  completedDeliveries: number;
  avgDeliveryMinutes: number | null;
  byZone: DeliveryZoneStat[];
}

export interface DeliveryHeatmapPoint {
  lat: number;
  lng: number;
}

export interface DeliveryHeatmap {
  points: DeliveryHeatmapPoint[];
}
