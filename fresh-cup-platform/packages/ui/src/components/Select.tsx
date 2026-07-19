import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "../cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  hideLabel?: boolean;
  /** Rendered as the first, disabled option — e.g. "All branches". */
  placeholder?: string;
}

/** Native <select>, styled to match Input — keyboard/screen-reader behavior comes for free. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, hint, hideLabel = false, placeholder, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className={cn("text-body-sm font-medium text-fg", hideLabel && "sr-only")}
      >
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn(
          "rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600",
          error && "border-error-600",
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error ? (
        <p id={hintId} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
});
