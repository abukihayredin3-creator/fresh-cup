"use client";

import { Avatar, Sidebar, SidebarNavItem, SidebarSection, Spinner } from "@fresh-cup/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { canAccessAdmin, useAuth } from "@/lib/auth-context";
import { visibleNavSections } from "@/lib/nav-config";
import { ThemeToggle } from "./ThemeToggle";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
  CASHIER: "Cashier",
  KITCHEN: "Kitchen",
  WAITER: "Waiter",
  INVENTORY_STAFF: "Inventory",
  MARKETING_STAFF: "Marketing",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isReady, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady) return;
    if (!user || !canAccessAdmin(user.role)) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isReady, user, pathname, router]);

  if (!isReady || !user || !canAccessAdmin(user.role)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const sections = visibleNavSections(user.role);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        header={<span className="font-display text-h5 text-fg">Fresh Cup</span>}
        footer={
          <div className="flex items-center gap-3">
            <Avatar name={user.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-fg">{user.fullName}</p>
              <p className="truncate text-caption text-fg-muted">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-caption text-fg-muted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
            >
              Sign out
            </button>
          </div>
        }
      >
        {sections.map((section) => (
          <SidebarSection key={section.label} label={section.label}>
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                as={Link}
              />
            ))}
          </SidebarSection>
        ))}
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-surface-alt px-6 py-3">
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
