import type { User } from "@fresh-cup/types";

export interface NavItemConfig {
  href: string;
  label: string;
  /** Omit for "visible to every admin-app role". */
  roles?: User["role"][];
}

export interface NavSectionConfig {
  label: string;
  items: NavItemConfig[];
}

const MANAGEMENT: User["role"][] = ["ADMIN", "MANAGER"];

export const NAV_SECTIONS: NavSectionConfig[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", roles: MANAGEMENT },
      { href: "/reports", label: "Reports", roles: MANAGEMENT },
      { href: "/customers", label: "Customers", roles: MANAGEMENT },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/menu", label: "Menu", roles: MANAGEMENT },
      {
        href: "/inventory",
        label: "Inventory",
        roles: [...MANAGEMENT, "INVENTORY_STAFF", "STAFF"],
      },
      { href: "/purchasing", label: "Purchasing", roles: [...MANAGEMENT, "INVENTORY_STAFF"] },
      { href: "/kitchen", label: "Kitchen", roles: [...MANAGEMENT, "KITCHEN", "STAFF"] },
      { href: "/delivery", label: "Delivery", roles: MANAGEMENT },
    ],
  },
  {
    label: "Growth",
    items: [{ href: "/marketing", label: "Marketing", roles: [...MANAGEMENT, "MARKETING_STAFF"] }],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/intelligence", label: "Executive", roles: MANAGEMENT },
      { href: "/intelligence/forecasting", label: "Forecasting", roles: MANAGEMENT },
      { href: "/intelligence/customers", label: "Customer AI", roles: MANAGEMENT },
      {
        href: "/intelligence/inventory",
        label: "Inventory AI",
        roles: [...MANAGEMENT, "INVENTORY_STAFF"],
      },
      {
        href: "/intelligence/marketing",
        label: "Marketing AI",
        roles: [...MANAGEMENT, "MARKETING_STAFF"],
      },
      { href: "/intelligence/recommendations", label: "Recommendations", roles: MANAGEMENT },
      { href: "/intelligence/assistant", label: "AI Assistant", roles: MANAGEMENT },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/branches", label: "Branches", roles: MANAGEMENT },
      { href: "/employees", label: "Employees", roles: MANAGEMENT },
      { href: "/settings", label: "Settings", roles: MANAGEMENT },
      { href: "/security", label: "Security" },
    ],
  },
];

export function visibleNavSections(role: User["role"] | undefined): NavSectionConfig[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || (role && item.roles.includes(role))),
  })).filter((section) => section.items.length > 0);
}
