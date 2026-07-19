import type { PermissionKey, UserRole } from "@fresh-cup/types";

/** Roles assignable to a staff account — excludes CUSTOMER (self-registers) and DRIVER (created via Delivery). */
export const STAFF_ROLES: UserRole[] = [
  "STAFF",
  "CASHIER",
  "KITCHEN",
  "WAITER",
  "INVENTORY_STAFF",
  "MARKETING_STAFF",
  "MANAGER",
  "ADMIN",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: "Customer",
  STAFF: "Staff",
  CASHIER: "Cashier",
  KITCHEN: "Kitchen",
  WAITER: "Waiter",
  INVENTORY_STAFF: "Inventory",
  MARKETING_STAFF: "Marketing",
  MANAGER: "Manager",
  ADMIN: "Admin",
  DRIVER: "Driver",
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  MENU_EDIT: "Edit menu",
  INVENTORY_MANAGE: "Manage inventory",
  PURCHASING_MANAGE: "Manage purchasing",
  EMPLOYEE_MANAGE: "Manage employees",
  MARKETING_MANAGE: "Manage marketing",
  SETTINGS_MANAGE: "Manage settings",
  REPORTS_VIEW: "View reports",
  FINANCE_VIEW: "View finance",
};

export const ALL_PERMISSIONS: PermissionKey[] = [
  "MENU_EDIT",
  "INVENTORY_MANAGE",
  "PURCHASING_MANAGE",
  "EMPLOYEE_MANAGE",
  "MARKETING_MANAGE",
  "SETTINGS_MANAGE",
  "REPORTS_VIEW",
  "FINANCE_VIEW",
];
