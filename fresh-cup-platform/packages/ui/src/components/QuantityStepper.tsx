import { cn } from "../cn";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Accessible label for the control as a whole, e.g. "Mango Sunrise quantity". */
  label: string;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  label,
  className,
}: QuantityStepperProps) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-3 rounded-pill border border-border px-1 py-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrement}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full text-h5 leading-none text-fg transition-colors hover:bg-border disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
      >
        &minus;
      </button>
      <span aria-live="polite" className="min-w-[1.5rem] text-center text-body font-medium text-fg">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrement}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full text-h5 leading-none text-fg transition-colors hover:bg-border disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
      >
        +
      </button>
    </div>
  );
}
