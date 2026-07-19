"use client";

import { Tabs } from "@fresh-cup/ui";
import { usePathname, useRouter } from "next/navigation";

const SECTIONS = [
  { id: "/ai-studio", label: "Agents & Copilot" },
  { id: "/ai-studio/approvals", label: "Approvals" },
  { id: "/ai-studio/knowledge", label: "Knowledge" },
  { id: "/ai-studio/workflows", label: "Workflows & Automation" },
  { id: "/ai-studio/simulator", label: "Simulator" },
  { id: "/ai-studio/evaluations", label: "Evaluations & Governance" },
];

export function AiStudioTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active = SECTIONS.find((s) => s.id === pathname)?.id ?? SECTIONS[0]!.id;

  return (
    <Tabs
      label="AI Studio section"
      items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
      value={active}
      onChange={(id) => router.push(id)}
    />
  );
}
