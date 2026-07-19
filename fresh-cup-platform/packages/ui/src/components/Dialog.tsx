"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../cn";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
}

/**
 * Built on the native <dialog> element: `showModal()` gives us a real focus
 * trap, ESC-to-close, and top-layer rendering for free — no portal or
 * hand-rolled focus management needed to meet WCAG's modal requirements.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  closeLabel = "Close",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-full max-w-md rounded-lg border border-border bg-surface-alt p-0 text-fg",
        "backdrop:bg-overlay",
        className,
      )}
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="dialog-title" className="font-display text-h4 text-fg">
            {title}
          </h2>
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
