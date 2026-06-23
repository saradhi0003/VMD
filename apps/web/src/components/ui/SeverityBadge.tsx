const styles: Record<string, { cls: string; icon: string }> = {
  critical: { cls: "bg-warn/15 text-warn", icon: "▲" },
  warning: { cls: "bg-surface-alt text-navy", icon: "•" },
  info: { cls: "bg-surface-alt text-ink-2", icon: "•" },
};

/** Coloured severity pill used on agent findings (owner dashboard + agent page). */
export function SeverityBadge({ severity }: { severity: string }) {
  const s = styles[severity] ?? { cls: "bg-surface-alt text-ink-2", icon: "•" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] ${s.cls}`}
    >
      <span aria-hidden>{s.icon}</span>
      {severity}
    </span>
  );
}
