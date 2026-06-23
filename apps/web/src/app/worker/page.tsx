import Link from "next/link";
import { requireWorker } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { EmptyState } from "@/components/ui";
import { completeReminder } from "./actions";

const ACTIONS = [
  { href: "/worker/log/milk", label: "Log milk", icon: "🥛" },
  { href: "/worker/log/feed", label: "Log feed", icon: "🌾" },
  { href: "/worker/log/health", label: "Log health", icon: "🩺" },
  { href: "/worker/scan", label: "Smart Scan", icon: "📷" },
  { href: "/worker/voice", label: "Voice entry", icon: "🎤" },
  { href: "/worker/log/wash", label: "Wash done", icon: "🧼" },
];

const LOGGED_MSG: Record<string, string> = {
  milk: "Milk session saved 🥛",
  health: "Health log saved 🩺",
  feed: "Feed log saved 🌾",
  wash: "Wash recorded 🧼",
};

export default async function WorkerHome({ searchParams }: { searchParams: Promise<{ logged?: string }> }) {
  const session = await requireWorker();
  const sp = await searchParams;
  const supabase = await createSupabaseServer();

  const { data: upcoming } = await supabase
    .from("reminders")
    .select("*")
    .eq("farm_id", session.profile.farm_id)
    .is("done_at", null)
    .gte("due_at", new Date(Date.now() - 86400000).toISOString())
    .order("due_at", { ascending: true })
    .limit(8);

  const reminders = upcoming ?? [];

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <RealtimeRefresher tables={["reminders", "activity_logs"]} farmId={session.profile.farm_id} />

      {sp.logged && LOGGED_MSG[sp.logged] && (
        <div className="flex items-center gap-2 rounded-tile bg-ok/10 px-4 py-3 text-base font-semibold text-ok" aria-live="polite">
          <span aria-hidden>✓</span> {LOGGED_MSG[sp.logged]}
        </div>
      )}

      <header className="flex items-center justify-between rounded-card bg-navy p-5 text-white">
        <div>
          <p className="text-sm text-white/70">Hello,</p>
          <h1 className="font-serif text-2xl">{session.profile.name}</h1>
        </div>
        <span className="rounded-pill bg-white/15 px-3 py-1 font-mono text-xs">{shiftLabel(new Date())}</span>
      </header>

      <section>
        <h2 className="eyebrow mb-2">Quick actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {ACTIONS.map((a) => (
            <ActionTile key={a.href} {...a} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-2">Today&apos;s reminders</h2>
        {reminders.length === 0 ? (
          <EmptyState icon="🎉" title="All caught up" hint="No reminders due right now." />
        ) : (
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-tile border border-line bg-white p-4">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-ink">{r.title}</div>
                  <div className="font-mono text-xs text-ink-2">
                    {new Date(r.due_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    <span className={`ml-2 ${priorityClass(r.priority)}`}>{r.priority}</span>
                  </div>
                </div>
                <form action={completeReminder}>
                  <input type="hidden" name="reminderId" value={r.id} />
                  <button
                    type="submit"
                    aria-label="Mark done"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-navy/30 text-navy transition hover:bg-navy hover:text-white"
                  >
                    ✓
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionTile({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-tile border border-line bg-white p-2 text-center transition hover:-translate-y-0.5 hover:border-navy/20 active:scale-[.98]"
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
    </Link>
  );
}

function priorityClass(p: string) {
  if (p === "high") return "font-medium text-warn";
  if (p === "medium") return "text-ink-2";
  return "text-ink-3";
}

function shiftLabel(d: Date) {
  const h = d.getHours();
  if (h < 11) return "Morning shift";
  if (h < 16) return "Day shift";
  return "Evening shift";
}
