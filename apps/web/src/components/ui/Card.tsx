import type { ReactNode } from "react";

type Tone = "white" | "surface" | "navy";

const tones: Record<Tone, string> = {
  white: "border border-line bg-white",
  surface: "bg-surface",
  navy: "bg-navy text-white",
};

export function Card({
  tone = "white",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`rounded-card p-5 ${tones[tone]} ${className}`}>{children}</div>;
}

/** Card section heading with an optional trailing action (e.g. a "View all" link). */
export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-tile border border-dashed border-line bg-surface px-6 py-10 text-center">
      {icon && <div className="text-3xl">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="text-sm text-ink-2">{hint}</p>}
    </div>
  );
}
