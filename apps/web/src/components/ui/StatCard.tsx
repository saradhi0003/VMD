import type { ReactNode } from "react";

/**
 * KPI tile (Pure). Mono uppercase label, Instrument-Serif value, optional
 * sparkline/visual slot beneath (see components/charts).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "navy",
  chart,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: "navy" | "blue" | "ok" | "warn";
  chart?: ReactNode;
}) {
  const accents: Record<string, string> = {
    navy: "text-navy bg-surface-alt",
    blue: "text-blue bg-surface-alt",
    ok: "text-ok bg-ok/10",
    warn: "text-warn bg-warn/10",
  };
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        {icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-tile text-sm ${accents[accent]}`}>{icon}</span>
        )}
      </div>
      <div className="mt-2 font-serif text-[2.6rem] leading-none text-ink">{value}</div>
      {hint && <div className="mt-1.5 font-mono text-xs text-ink-2">{hint}</div>}
      {chart && <div className="mt-3 -mb-1 h-10">{chart}</div>}
    </div>
  );
}
