"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

const toastStyles: Record<
  ToastType,
  { bg: string; border: string; text: string; icon: string; muted: string }
> = {
  success: {
    bg: "color-mix(in srgb, var(--accent) 18%, var(--surface))",
    border: "color-mix(in srgb, var(--accent) 45%, var(--border))",
    text: "var(--text)",
    icon: "var(--accent-bright)",
    muted: "var(--text-muted)",
  },
  error: {
    bg: "color-mix(in srgb, #DC2626 18%, var(--surface))",
    border: "color-mix(in srgb, #DC2626 45%, var(--border))",
    text: "var(--text)",
    icon: "#DC2626",
    muted: "var(--text-muted)",
  },
  info: {
    bg: "color-mix(in srgb, #0284C7 18%, var(--surface))",
    border: "color-mix(in srgb, #0284C7 45%, var(--border))",
    text: "var(--text)",
    icon: "#0284C7",
    muted: "var(--text-muted)",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const style = toastStyles[t.type];
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg animate-slide-up backdrop-blur-sm"
              style={{
                minWidth: 280,
                maxWidth: 400,
                background: style.bg,
                borderColor: style.border,
                color: style.text,
              }}
            >
              <Icon size={16} className="shrink-0" style={{ color: style.icon }} />
              <span className="text-sm flex-1 font-medium" style={{ color: style.text }}>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                className="bg-transparent border-none shrink-0"
                style={{ color: style.muted }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
