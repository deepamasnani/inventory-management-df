"use client";

import { LucideIcon } from "lucide-react";

const toneStyles: Record<string, { text: string; iconBg: string; iconFg: string }> = {
  ink: { text: "var(--text)", iconBg: "var(--color-brand-soft)", iconFg: "var(--accent)" },
  teal: { text: "var(--accent-bright)", iconBg: "var(--color-brand-soft)", iconFg: "var(--accent)" },
  amber: { text: "#D97706", iconBg: "color-mix(in srgb, #D97706 16%, var(--surface))", iconFg: "#D97706" },
  red: { text: "#DC2626", iconBg: "color-mix(in srgb, #DC2626 16%, var(--surface))", iconFg: "#DC2626" },
  blue: { text: "#0284C7", iconBg: "color-mix(in srgb, #0284C7 16%, var(--surface))", iconFg: "#0284C7" },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "ink",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: string;
}) {
  const style = toneStyles[tone] || toneStyles.ink;
  return (
    <div className="themed-card rounded-[20px] p-5 flex-1 min-w-[160px] h-full">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: style.iconBg }}
        >
          <Icon size={18} style={{ color: style.iconFg }} />
        </div>
      </div>
      <div className="themed-muted text-[11px] uppercase tracking-wide font-semibold mb-1.5">
        {label}
      </div>
      <div className="font-bold text-2xl tracking-tight" style={{ color: style.text }}>
        {value}
      </div>
    </div>
  );
}
