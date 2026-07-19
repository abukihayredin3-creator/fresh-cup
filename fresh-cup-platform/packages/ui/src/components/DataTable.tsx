import type { ReactNode } from "react";
import { cn } from "../cn";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Right-aligns the column — for numeric/currency values. */
  align?: "start" | "end";
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Accessible caption — visually hidden by default but announced by screen readers. */
  caption?: string;
}

const SKELETON_ROWS = 5;

/**
 * A plain HTML table wrapped for horizontal overflow — no virtualization,
 * client-side sort/filter, or column resize. Fine at admin-dashboard scale
 * (hundreds of rows via cursor pagination), consistent with the rest of the
 * platform's "no premature infrastructure" approach.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = "No results",
  emptyDescription,
  onRowClick,
  className,
  caption,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
      <table className="w-full min-w-max border-collapse text-body-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border bg-surface">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 font-medium text-fg-muted",
                  column.align === "end" ? "text-right" : "text-left",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => i).map((rowIndex) => (
                <tr key={rowIndex} className="border-b border-border last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-border bg-surface-alt last:border-0",
                    onRowClick && "cursor-pointer hover:bg-tint-green",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-3 text-fg",
                        column.align === "end" ? "text-right" : "text-left",
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          className="border-t border-border"
        />
      ) : null}
    </div>
  );
}
