"use client";

import { Tabs } from "@fresh-cup/ui";
import { usePathname, useRouter } from "next/navigation";

const SECTIONS = [
  { id: "/analytics", label: "Sales" },
  { id: "/analytics/products", label: "Products" },
  { id: "/analytics/customers", label: "Customers" },
  { id: "/analytics/kitchen", label: "Kitchen" },
  { id: "/analytics/delivery", label: "Delivery" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active = SECTIONS.find((s) => s.id === pathname)?.id ?? SECTIONS[0]!.id;

  return (
    <Tabs
      label="Analytics section"
      items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
      value={active}
      onChange={(id) => router.push(id)}
    />
  );
}
