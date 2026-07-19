import type { ComponentType, ElementType, ReactNode } from "react";
import { cn } from "../cn";

export interface SidebarProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Fixed-width admin nav rail. Callers own routing — SidebarNavItem takes an `active` flag, not a route. */
export function Sidebar({ children, header, footer, className }: SidebarProps) {
  return (
    <nav
      aria-label="Admin navigation"
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface-alt",
        className,
      )}
    >
      {header ? <div className="border-b border-border p-4">{header}</div> : null}
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
      {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
    </nav>
  );
}

export interface SidebarSectionProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function SidebarSection({ label, children, className }: SidebarSectionProps) {
  return (
    <div className={cn("mb-4", className)}>
      <p className="px-3 pb-1 text-caption font-medium uppercase tracking-wide text-fg-muted">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export interface SidebarNavItemProps {
  href: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: ReactNode;
  /** Defaults to a plain anchor — pass your router's Link component for client-side navigation. */
  as?: ComponentType<{
    href: string;
    className?: string;
    children: ReactNode;
    "aria-current"?: "page";
  }>;
}

export function SidebarNavItem({
  href,
  label,
  icon,
  active = false,
  badge,
  as: Component,
}: SidebarNavItemProps) {
  const Comp = (Component ?? "a") as ElementType;
  return (
    <Comp
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded px-3 py-2 text-body-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600",
        active ? "bg-tint-green text-fg" : "text-fg-muted hover:bg-tint-green hover:text-fg",
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{label}</span>
      {badge}
    </Comp>
  );
}
