/** Striped image slot (§11) — a labelled placeholder the family swaps for a real photo. */
export function PlaceholderImage({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`ph-stripe relative overflow-hidden rounded-tile ${className}`}>
      <span className="absolute left-3 top-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
    </div>
  );
}
