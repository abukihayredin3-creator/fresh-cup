import { cn } from "../cn";

export interface SkeletonProps {
  className?: string;
  /** Rounded pill instead of the default rounded rect — for avatar/badge placeholders. */
  circle?: boolean;
}

/** Loading placeholder. Decorative — `aria-hidden` so screen readers skip it. */
export function Skeleton({ className, circle = false }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-border", circle ? "rounded-full" : "rounded", className)}
    />
  );
}
