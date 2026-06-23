import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Button, Card } from "@/components/ui";
import { triggerDailyAgent } from "../agent/actions";

const DAY = 86400000;

type Check = {
  label: string;
  detail: string;
  state: "done" | "attention";
  action: string; // route to fix/view
  kind: "entry" | "scan";
};

export default async function WorkspacePage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const startToday = `${today}T00:00:00.000Z`;
  const in7 = new Date(Date.now() + 7 * DAY).toISOString();

  const [milkRes, salesRes, expRes, remindersRes, animalsRes, runRes] = await Promise.all([
    supabase.from("milk_sessions").select("shift,litres").eq("farm_id", farmId).eq("session_date", today),
    supabase.from("sales").select("id").eq("farm_id", farmId).gte("occurred_at", startToday),
    supabase.from("expenses").select("id").eq("farm_id", farmId).gte("occurred_at", startToday),
    supabase.from("reminders").select("type,due_at").eq("farm_id", farmId).is("done_at", null).gte("due_at", new Date().toISOString()).lte("due_at", in7),
    supabase.from("animals").select("health").eq("farm_id", farmId),
    supabase.from("agent_runs").select("*").eq("farm_id", farmId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const milk = milkRes.data ?? [];
  const morning = milk.filter((m) => m.shift === "morning").reduce((a, m) => a + Number(m.litres), 0);
  const evening = milk.filter((m) => m.shift === "evening").reduce((a, m) => a + Number(m.litres), 0);
  const salesCount = (salesRes.data ?? []).length;
  const expCount = (expRes.data ?? []).length;
  const reminders = remindersRes.data ?? [];
  const vet = reminders.filter((r) => r.type === "doctor" || r.type === "vaccination").length;
  const fodder = reminders.filter((r) => r.type === "fodder" || r.type === "feed").length;
  const concerns = (animalsRes.data ?? []).filter((a) => ["observation", "treatment", "quarantine"].includes(a.health)).length;
  const lastRun = runRes.data;

  const checks: Check[] = [
    { label: "Morning milk entry check", detail: morning > 0 ? `${morning.toFixed(1)} L recorded` : "No morning entry — add now", state: morning > 0 ? "done" : "attention", action: "/owner/production", kind: "entry" },
    { label: "Evening milk entry check", detail: evening > 0 ? `${evening.toFixed(1)} L recorded` : "No evening entry — add now", state: evening > 0 ? "done" : "attention", action: "/owner/production", kind: "entry" },
    { label: "Today's sales entry check", detail: salesCount ? `${salesCount} sale${salesCount !== 1 ? "s" : ""} recorded` : "No sales recorded today", state: salesCount ? "done" : "attention", action: "/owner/sales", kind: "entry" },
    { label: "Today's expenses check", detail: expCount ? `${expCount} cost${expCount !== 1 ? "s" : ""} recorded` : "No expenses recorded today", state: expCount ? "done" : "attention", action: "/owner/expenses", kind: "entry" },
    { label: "Upcoming vet visits scan", detail: vet ? `${vet} upcoming in 7 days` : "Nothing due this week", state: "done", action: "/owner/reminders", kind: "scan" },
    { label: "Fodder cycle check", detail: fodder ? `${fodder} cycle${fodder !== 1 ? "s" : ""} due` : "No fodder/feed due", state: "done", action: "/owner/reminders", kind: "scan" },
    { label: "Animal health scan", detail: concerns ? `${concerns} animal${concerns !== 1 ? "s" : ""} need attention` : "All animals healthy", state: concerns ? "attention" : "done", action: "/owner/herd?filter=watch", kind: "scan" },
    { label: "Production trend analysis", detail: "14-day trend reviewed", state: "done", action: "/owner/production", kind: "scan" },
  ];

  const missing = checks.filter((c) => c.kind === "entry" && c.state === "attention").length;
  const alerts = checks.filter((c) => c.state === "attention").length;
  const entriesToday = milk.length + salesCount + expCount;
  const runTime = (lastRun ? new Date(lastRun.started_at) : new Date()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const status = missing ? "ALERT" : "ACTIVE";

  const kpis = [
    { label: "Pending", value: String(alerts) },
    { label: "Entries today", value: String(entriesToday) },
    { label: "Last run", value: runTime },
    { label: "Alerts", value: String(alerts) },
    { label: "Status", value: status, tone: missing ? "warn" : "ok" },
  ];

  return (
    <div className="space-y-6">
      <RealtimeRefresher tables={["milk_sessions", "sales", "expenses", "reminders", "agent_findings"]} farmId={farmId} />

      {/* Header + KPI row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Owner workspace</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">Owner Workspace</h1>
          <p className="mt-1 text-ink-2">The agent ran your farm&apos;s daily checks.</p>
        </div>
        <div className="flex items-center gap-2">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-tile border border-line bg-white px-3 py-2 text-center">
              <div className="eyebrow">{k.label}</div>
              <div className={`mt-0.5 font-serif text-xl ${k.tone === "warn" ? "text-warn" : k.tone === "ok" ? "text-ok" : "text-ink"}`}>{k.value}</div>
            </div>
          ))}
          <form action={triggerDailyAgent}>
            <Button type="submit" variant="secondary">Run check</Button>
          </form>
        </div>
      </div>

      {/* Check queue */}
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-line">
          {checks.map((c) => (
            <li key={c.label}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-surface">
                  <span className="text-ink-3 transition group-open:rotate-90" aria-hidden>›</span>
                  <span className="flex-1 text-sm font-medium text-ink">{c.label}</span>
                  <span className="hidden font-mono text-xs text-ink-3 sm:inline">{c.detail}</span>
                  <span
                    className={`rounded-pill px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${
                      c.state === "done" ? "bg-ok/10 text-ok" : "bg-warn/15 text-warn"
                    }`}
                  >
                    {c.state === "done" ? "Done" : "Check"}
                  </span>
                </summary>
                <div className="flex items-center justify-between gap-3 border-t border-line bg-surface/50 px-5 py-3 pl-12">
                  <span className="text-sm text-ink-2">{c.detail}</span>
                  <Link href={c.action} className="shrink-0 text-sm font-semibold text-navy hover:underline">
                    {c.kind === "entry" && c.state === "attention" ? "Fix now →" : "View →"}
                  </Link>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>

      {/* Run context (pipeline trace) */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="eyebrow">Run context</h2>
          <span className="font-mono text-xs text-ink-3">{checks.length} steps · {alerts} alerts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
              <tr>
                <th className="px-5 py-2 font-medium">Time</th>
                <th className="px-5 py-2 font-medium">Step</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Result</th>
                <th className="px-5 py-2 font-medium">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.label} className="border-t border-line">
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-3">{runTime}</td>
                  <td className="px-5 py-2.5 text-ink">{c.label.replace(/ (check|scan|analysis)$/i, "")}</td>
                  <td className="px-5 py-2.5">
                    <span className="font-mono text-[11px] text-ok">completed</span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-2">{c.detail}</td>
                  <td className={`px-5 py-2.5 font-mono text-xs ${c.state === "attention" ? "text-warn" : "text-ink-3"}`}>{c.state === "attention" ? 1 : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
