"use client";

import { ReactNode } from "react";

const toneStyles: Record<string, { bg: string; fg: string; bd: string }> = {
  ink: {
    bg: "var(--surface-muted)",
    fg: "var(--text)",
    bd: "var(--border-strong)",
  },
  teal: {
    bg: "color-mix(in srgb, var(--accent) 18%, var(--surface))",
    fg: "var(--accent-bright)",
    bd: "color-mix(in srgb, var(--accent) 35%, var(--border))",
  },
  amber: {
    bg: "color-mix(in srgb, #D97706 16%, var(--surface))",
    fg: "#D97706",
    bd: "color-mix(in srgb, #D97706 35%, var(--border))",
  },
  red: {
    bg: "color-mix(in srgb, #E05A5A 16%, var(--surface))",
    fg: "#E05A5A",
    bd: "color-mix(in srgb, #E05A5A 35%, var(--border))",
  },
  green: {
    bg: "color-mix(in srgb, #1F9B5A 16%, var(--surface))",
    fg: "#3DC97A",
    bd: "color-mix(in srgb, #1F9B5A 35%, var(--border))",
  },
};

export function Tag({ children, tone = "ink" }: { children: ReactNode; tone?: string }) {
  const t = toneStyles[tone] || toneStyles.ink;
  return (
    <span
      className="border rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
      style={{ background: t.bg, color: t.fg, borderColor: t.bd }}
    >
      {children}
    </span>
  );
}
