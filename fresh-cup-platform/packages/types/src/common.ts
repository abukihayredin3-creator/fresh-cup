/**
 * Framework-agnostic primitives shared across every Fresh Cup app.
 * Domain models (Order, MenuItem, etc.) are intentionally not defined yet —
 * they land in Phase 1 alongside the API endpoints that own them.
 */

export type UUID = string;

export type ISODateString = string;

export type Locale = "en" | "am";

export type Nullable<T> = T | null;

/** Money is always represented in integer minor units (e.g. ETB cents-equivalent). */
export interface Money {
  amount: number;
  currency: "ETB";
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
