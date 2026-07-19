import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Renders without padding, for cards that manage their own inner layout (e.g. ProductCard). */
  padded?: boolean;
}

/** Base surface: theme-aware background, neutral border, no drop shadow by default. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, children, padded = true, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("rounded-lg border border-border bg-surface-alt", padded && "p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
});
