import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "../cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Visually hides the label while keeping it accessible to screen readers. */
  hideLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, hideLabel = false, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn("text-body-sm font-medium text-fg", hideLabel && "sr-only")}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn(
          "rounded border border-border bg-surface-alt px-3 py-2 text-body text-fg placeholder:text-fg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600",
          error && "border-error-600",
          className,
        )}
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-error-600">
          {error}
        </p>
      ) : null}
    </div>
  );
});
