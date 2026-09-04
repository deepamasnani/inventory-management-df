"use client";

import { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`themed-card rounded-[20px] p-5 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function StitchDivider() {
  return <div className="my-4" style={{ borderTop: "1px solid var(--border)" }} />;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="themed-muted text-[11px] uppercase tracking-wide mb-1.5 font-semibold">
      {children}
    </div>
  );
}
