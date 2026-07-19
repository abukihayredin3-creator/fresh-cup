import { useId } from "react";
import { cn } from "../cn";

export interface DateRangeValue {
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

/** Two native date inputs — no calendar-picker chrome to hand-roll, the browser already has one. */
export function DateRangePicker({
  value,
  onChange,
  fromLabel = "From",
  toLabel = "To",
  className,
}: DateRangePickerProps) {
  const fromId = useId();
  const toId = useId();

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fromId} className="text-body-sm font-medium text-fg">
          {fromLabel}
        </label>
        <input
          id={fromId}
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className={cn(
            "rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600",
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={toId} className="text-body-sm font-medium text-fg">
          {toLabel}
        </label>
        <input
          id={toId}
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className={cn(
            "rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600",
          )}
        />
      </div>
    </div>
  );
}
