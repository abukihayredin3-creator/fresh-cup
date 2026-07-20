"use client";

import { Tabs } from "@fresh-cup/ui";
import { usePathname, useRouter } from "next/navigation";

const SECTIONS = [
  { id: "/enterprise", label: "Organization" },
  { id: "/enterprise/regions", label: "Regions" },
  { id: "/enterprise/franchises", label: "Franchises" },
  { id: "/enterprise/feature-flags", label: "Feature Flags" },
  { id: "/enterprise/licensing", label: "Licensing" },
  { id: "/enterprise/security", label: "SSO & Security" },
  { id: "/enterprise/globalization", label: "Currency & Tax" },
  { id: "/enterprise/analytics", label: "Analytics" },
];

export function EnterpriseTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active = SECTIONS.find((s) => s.id === pathname)?.id ?? SECTIONS[0]!.id;

  return (
    <Tabs
      label="Enterprise section"
      items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
      value={active}
      onChange={(id) => router.push(id)}
    />
  );
}
