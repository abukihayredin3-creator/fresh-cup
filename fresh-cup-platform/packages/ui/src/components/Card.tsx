import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Base surface: warm-white background, neutral border, no drop shadow by default. */
export function Card({ className, children, ...props }: CardProps) {
  const classes = ["rounded-lg border border-neutral-200 bg-warm-white p-6", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
