"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "../cn";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "error";
  durationMs?: number;
}

interface ToastContextValue {
  show: (toast: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<NonNullable<ToastMessage["tone"]>, string> = {
  neutral: "border-border",
  success: "border-success-600",
  error: "border-error-600",
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ToastMessage, "id">) => {
      const id = `toast-${(nextId += 1)}`;
      setToasts((current) => [...current, { id, ...toast }]);
      const duration = toast.durationMs ?? 5000;
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-lg border bg-surface-alt p-4 shadow-lg",
              TONE_CLASSES[toast.tone ?? "neutral"],
            )}
          >
            <p className="text-body-sm font-medium text-fg">{toast.title}</p>
            {toast.description ? (
              <p className="mt-1 text-caption text-fg-muted">{toast.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
