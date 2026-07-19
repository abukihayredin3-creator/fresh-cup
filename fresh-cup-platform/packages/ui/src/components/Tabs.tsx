"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../cn";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}

/** Roving-tabindex tablist per the WAI-ARIA Tabs pattern — arrow keys move focus and selection. */
export function Tabs({ items, value, onChange, label, className }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusAndSelect(id: string) {
    onChange(id);
    refs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.id === value);
    if (index === -1) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAndSelect(items[(index + 1) % items.length]!.id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAndSelect(items[(index - 1 + items.length) % items.length]!.id);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAndSelect(items[0]!.id);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAndSelect(items[items.length - 1]!.id);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn("flex gap-2 overflow-x-auto", className)}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[item.id] = el;
            }}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "whitespace-nowrap rounded-pill px-4 py-2 text-body-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600",
              selected ? "bg-green-900 text-warm-white" : "bg-transparent text-fg hover:bg-border",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  activeId: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, activeId, children, className }: TabPanelProps) {
  if (id !== activeId) return null;
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  );
}
