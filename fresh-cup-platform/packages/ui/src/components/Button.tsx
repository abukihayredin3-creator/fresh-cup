import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-orange-600 text-white hover:bg-orange-600/90",
  secondary: "bg-green-900 text-warm-white hover:bg-green-700",
  ghost: "bg-transparent text-green-900 hover:bg-green-100",
};

/** Base brand button. One primary (orange) action per screen — see DESIGN_SYSTEM.md. */
export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center rounded px-4 py-2 font-sans text-body font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
