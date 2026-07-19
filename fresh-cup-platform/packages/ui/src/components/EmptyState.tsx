import type { ReactNode } from "react";
import { cn } from "../cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-12 text-center", className)}>
      {icon ? (
        <div aria-hidden="true" className="text-fg-muted">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-h5 text-fg">{title}</p>
      {description ? <p className="max-w-sm text-body-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
