import { UserRole } from "@prisma/client";

/** Every role except CUSTOMER — for self-service endpoints any employee can use. */
export const STAFF_ROLES: UserRole[] = [
  UserRole.STAFF,
  UserRole.MANAGER,
  UserRole.ADMIN,
  UserRole.DRIVER,
  UserRole.CASHIER,
  UserRole.KITCHEN,
  UserRole.WAITER,
  UserRole.INVENTORY_STAFF,
  UserRole.MARKETING_STAFF,
];
