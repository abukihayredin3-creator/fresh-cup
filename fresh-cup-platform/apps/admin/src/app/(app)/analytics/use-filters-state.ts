"use client";

import type { DateRangeValue } from "@fresh-cup/ui";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminBranches } from "@/lib/use-dashboard";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(to) };
}

/** Shared date-range + branch filter state for every /analytics sub-page. */
export function useAnalyticsFilters() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { data: branches } = useAdminBranches(isAdmin);

  return {
    range,
    setRange,
    branchId,
    setBranchId,
    branches,
    isAdmin,
    params: { from: range.from, to: range.to, branchId },
  };
}
