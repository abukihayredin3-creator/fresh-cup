import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "green" | "orange" | "error";
  children: ReactNode;
}

// Text is theme-aware `text-fg`, not a fixed brand color, on every tint
// background — a dark-mode tint and its matching brand color can land too
// close in luminance (e.g. dark-mode tint-green vs. green-900) to clear
// WCAG AA on their own; `fg` is guaranteed to contrast its own surface.
const TONE_CLASSES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-border text-fg",
  green: "bg-tint-green text-fg",
  orange: "bg-tint-orange text-fg",
  error: "bg-error-600/15 text-error-600",
};

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
