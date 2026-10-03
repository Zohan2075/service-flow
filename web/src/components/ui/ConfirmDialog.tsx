"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  title?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  title,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xl dark:border-slate-700">
        {title && (
          <p className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</p>
        )}
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "min-h-11 flex-1 rounded-xl px-3 text-sm font-bold text-white",
              danger ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
