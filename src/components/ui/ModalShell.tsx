"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";

export function ModalShell({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      style={{ background: "color-mix(in srgb, var(--text) 28%, transparent)" }}
      onClick={onClose}
    >
      <div
        className={`rounded-[24px] p-6 max-h-[85vh] overflow-y-auto animate-scale-in themed-card ${
          wide ? "w-[640px]" : "w-[440px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="font-bold text-lg themed-title">{title}</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border-none transition-colors"
            style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
