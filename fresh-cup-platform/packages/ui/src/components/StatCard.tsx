import type { ReactNode } from "react";
import { cn } from "../cn";
import { Card } from "./Card";
import { Skeleton } from "./Skeleton";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** e.g. "+12% vs last week" — sign/tone conveyed via `trend`. */
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

const TREND_CLASSES: Record<NonNullable<StatCardProps["trend"]>, string> = {
  up: "text-success-text",
  down: "text-danger-text",
  neutral: "text-fg-muted",
};

/** A single KPI tile — dashboard/analytics pages compose a grid of these. */
export function StatCard({
  label,
  value,
  delta,
  trend = "neutral",
  icon,
  loading = false,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm font-medium text-fg-muted">{label}</p>
        {icon ? (
          <div aria-hidden="true" className="text-fg-muted">
            {icon}
          </div>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="font-display text-h3 text-fg">{value}</p>
      )}
      {delta && !loading ? (
        <p className={cn("text-caption font-medium", TREND_CLASSES[trend])}>{delta}</p>
      ) : null}
    </Card>
  );
}
