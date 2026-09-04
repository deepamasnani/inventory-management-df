"use client";

import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]" onClick={onCancel}>
      <div
        className="themed-card rounded-xl p-6 w-[380px] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2 rounded-full ${danger ? "bg-red-50" : "bg-amber-50"}`}>
            <AlertTriangle size={20} className={danger ? "text-red-500" : "text-amber-500"} />
          </div>
          <div>
            <div className="font-semibold text-[15px] mb-1 themed-title">{title}</div>
            <div className="text-sm themed-muted">{message}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
