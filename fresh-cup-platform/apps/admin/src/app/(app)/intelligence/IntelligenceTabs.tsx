"use client";

import { Tabs } from "@fresh-cup/ui";
import { usePathname, useRouter } from "next/navigation";

const SECTIONS = [
  { id: "/intelligence", label: "Executive" },
  { id: "/intelligence/forecasting", label: "Forecasting" },
  { id: "/intelligence/customers", label: "Customer AI" },
  { id: "/intelligence/inventory", label: "Inventory AI" },
  { id: "/intelligence/marketing", label: "Marketing AI" },
  { id: "/intelligence/predictive", label: "Predictive Intelligence" },
  { id: "/intelligence/recommendations", label: "Recommendations" },
  { id: "/intelligence/assistant", label: "AI Assistant" },
];

export function IntelligenceTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active = SECTIONS.find((s) => s.id === pathname)?.id ?? SECTIONS[0]!.id;

  return (
    <Tabs
      label="Intelligence section"
      items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
      value={active}
      onChange={(id) => router.push(id)}
    />
  );
}
