import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Card, CardHeader } from "@/components/ui";
import { MilkTrendChart, RevenueExpenseChart } from "@/components/charts/lazy";
import { lastNDates, seriesFor, sumByDay } from "@/lib/series";
import { triggerDailyAgent } from "./agent/actions";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const DAY = 86400000;

const QUICK = [
  { href: "/owner/production", label: "Add Milk", icon: "🥛" },
  { href: "/owner/sales", label: "Add Sale", icon: "₹" },
  { href: "/owner/expenses", label: "Add Cost", icon: "🧾" },
  { href: "/owner/assistant", label: "Speak Entry", icon: "🎤" },
];

export default async function OwnerDashboardPage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();

  const dates = lastNDates(14);
  const today = dates[dates.length - 1]!;
  const start14 = `${dates[0]}T00:00:00.000Z`;
  const start30 = new Date(Date.now() - 30 * DAY).toISOString();

  const [milkRes, salesRes, expRes, remindersRes, customersRes] = await Promise.all([
    supabase.from("milk_sessions").select("session_date,litres,fat_pct,shift").eq("farm_id", farmId).gte("session_date", dates[0]!),
    supabase.from("sales").select("occurred_at,amount_minor,customer_id").eq("farm_id", farmId).gte("occurred_at", start30),
    supabase.from("expenses").select("occurred_at,amount_minor").eq("farm_id", farmId).gte("occurred_at", start14),
    supabase.from("reminders").select("*").eq("farm_id", farmId).is("done_at", null).gte("due_at", new Date().toISOString()).lte("due_at", new Date(Date.now() + 7 * DAY).toISOString()).order("due_at").limit(6),
    supabase.from("customers").select("id,name").eq("farm_id", farmId),
  ]);

  const milkRows = milkRes.data ?? [];
  const salesRows = salesRes.data ?? [];
  const expenseRows = expRes.data ?? [];
  const reminders = remindersRes.data ?? [];
  const custName = new Map((customersRes.data ?? []).map((c) => [c.id, c.name]));

  // Per-day series for charts
  const milkByDay = sumByDay(milkRows, (r) => r.session_date, (r) => Number(r.litres));
  const revByDay = sumByDay(salesRows, (r) => r.occurred_at.slice(0, 10), (r) => r.amount_minor / 100);
  const expByDay = sumByDay(expenseRows, (r) => r.occurred_at.slice(0, 10), (r) => r.amount_minor / 100);
  const milkSeries = seriesFor(dates, milkByDay).map((p) => ({ date: p.date, litres: p.value }));
  const moneySeries = dates.map((date) => ({ date, revenue: Math.round(revByDay.get(date) ?? 0), expense: Math.round(expByDay.get(date) ?? 0) }));

  // Today
  const todayMilkRows = milkRows.filter((r) => r.session_date === today);
  const milkToday = todayMilkRows.reduce((a, r) => a + Number(r.litres), 0);
  const morningOk = todayMilkRows.some((r) => r.shift === "morning");
  const eveningOk = todayMilkRows.some((r) => r.shift === "evening");
  const salesToday = salesRows.filter((s) => s.occurred_at.slice(0, 10) === today).reduce((a, s) => a + s.amount_minor, 0) / 100;
  const costsToday = expenseRows.filter((e) => e.occurred_at.slice(0, 10) === today).reduce((a, e) => a + e.amount_minor, 0) / 100;
  const netToday = salesToday - costsToday;

  const missing = [morningOk, eveningOk, salesToday > 0, costsToday > 0].filter((ok) => !ok).length;
  const allGood = missing === 0;

  // Insights
  const last7 = dates.slice(-7);
  const avg7 = last7.reduce((a, d) => a + (milkByDay.get(d) ?? 0), 0) / 7;
  const trendPct = avg7 > 0 ? Math.round(((milkToday - avg7) / avg7) * 100) : 0;
  const fats = milkRows.filter((r) => r.fat_pct != null).map((r) => r.fat_pct as number);
  const avgFat = fats.length ? fats.reduce((a, b) => a + b, 0) / fats.length : null;
  const week = dates.slice(-7).map((d) => `${d}`);
  const weekRev = salesRows.filter((s) => s.occurred_at.slice(0, 10) >= week[0]!).reduce((a, s) => a + s.amount_minor, 0) / 100;
  const weekExp = expenseRows.filter((e) => e.occurred_at.slice(0, 10) >= week[0]!).reduce((a, e) => a + e.amount_minor, 0) / 100;
  const margin = weekRev > 0 ? Math.round(((weekRev - weekExp) / weekRev) * 100) : 0;
  const spendByCust = new Map<string, number>();
  for (const s of salesRows) if (s.customer_id) spendByCust.set(s.customer_id, (spendByCust.get(s.customer_id) ?? 0) + s.amount_minor / 100);
  const top = [...spendByCust.entries()].sort((a, b) => b[1] - a[1])[0];

  const insights = [
    { title: "Milk production trend", detail: `Today ${milkToday.toFixed(0)} L · 7-day average ${avg7.toFixed(0)} L (${trendPct >= 0 ? "+" : ""}${trendPct}%)` },
    { title: "Quality & fat", detail: avgFat != null ? `Average fat ${avgFat.toFixed(1)}% over 14 days — ${avgFat >= 4 ? "within healthy range" : "trending low, review feed"}` : "No fat readings yet" },
    { title: "Financial health", detail: `Net ${rupees.format(weekRev - weekExp)} this week · margin ${margin}%` },
    { title: "Top customer", detail: top ? `${custName.get(top[0]) ?? "—"} — ${rupees.format(top[1])} over 30 days` : "No sales yet" },
  ];

  const kpis = [
    { label: "Milk today", value: `${milkToday.toFixed(0)} L`, highlight: false },
    { label: "Sales today", value: rupees.format(salesToday), highlight: false },
    { label: "Costs today", value: rupees.format(costsToday), highlight: false },
    { label: "Net today", value: rupees.format(netToday), highlight: true },
  ];

  return (
    <div className="space-y-6">
      <RealtimeRefresher tables={["milk_sessions", "sales", "expenses", "reminders"]} farmId={farmId} />

      {/* Status hero */}
      <section className={`rounded-card p-6 text-white ${allGood ? "bg-navy" : "bg-warn"}`}>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">AI farm-check</p>
        <h1 className="mt-2 font-serif text-3xl">
          {allGood ? "All critical entries look good today" : `${missing} ${missing === 1 ? "entry" : "entries"} need attention today`}
        </h1>
        <p className="mt-1 text-white/80">
          {allGood ? "Milk, sales and costs are all recorded." : "Milk, sales or costs are missing — tap to fix."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/owner/production" className="rounded-pill bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-white/90">Add Milk</Link>
          <form action={triggerDailyAgent}>
            <button className="rounded-pill border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Run Check</button>
          </form>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-card border bg-white p-5 ${k.highlight ? "border-blue ring-1 ring-blue/30" : "border-line"}`}>
            <div className="eyebrow">{k.label}</div>
            <div className="mt-2 font-serif text-[2.4rem] leading-none text-ink">{k.value}</div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="eyebrow mb-2">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-tile border border-line bg-white p-4 transition hover:border-navy/20">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-surface-alt text-lg text-navy" aria-hidden>{q.icon}</span>
              <span className="text-sm font-semibold text-ink">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming reminders */}
      <section>
        <h2 className="eyebrow mb-2">Upcoming reminders</h2>
        {reminders.length === 0 ? (
          <p className="rounded-tile border border-line bg-white px-4 py-3 text-sm text-ink-2">No reminders in the next 7 days.</p>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-tile border border-line bg-white px-4 py-3">
                <span className="text-sm font-medium text-ink">{r.title}</span>
                <span className="font-mono text-xs text-ink-3">
                  {new Date(r.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {r.priority}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Milk trend · 14 days" action={<Link href="/owner/production" className="text-sm font-semibold text-navy hover:underline">Details →</Link>} />
          <MilkTrendChart data={milkSeries} />
        </Card>
        <Card>
          <CardHeader title="Sales vs costs · 14 days" />
          <RevenueExpenseChart data={moneySeries} />
        </Card>
      </section>

      {/* Insights */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-5 py-3"><h2 className="eyebrow">Insights</h2></div>
        <ul className="divide-y divide-line">
          {insights.map((i) => (
            <li key={i.title} className="px-5 py-3.5">
              <div className="text-sm font-semibold text-ink">{i.title}</div>
              <div className="mt-0.5 text-sm text-ink-2">{i.detail}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
