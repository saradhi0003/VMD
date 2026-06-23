import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui";
import { MilkTrendChart } from "@/components/charts/lazy";
import { lastNDates, seriesFor, sumByDay } from "@/lib/series";
import { logMilkSession } from "./actions";

function fatClass(fat: number | null) {
  if (fat == null) return "text-ink-3";
  if (fat >= 4) return "text-ok font-medium";
  if (fat >= 3) return "text-ink";
  return "text-warn";
}

export default async function ProductionPage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();

  const dates = lastNDates(14);

  const [recentRes, trendRes] = await Promise.all([
    supabase.from("milk_sessions").select("*").eq("farm_id", farmId).order("session_date", { ascending: false }).order("created_at", { ascending: false }).limit(20),
    supabase.from("milk_sessions").select("session_date,litres").eq("farm_id", farmId).gte("session_date", dates[0]!),
  ]);

  const recent = recentRes.data ?? [];
  const milkByDay = sumByDay(trendRes.data ?? [], (r) => r.session_date, (r) => Number(r.litres));
  const milkSeries = seriesFor(dates, milkByDay).map((p) => ({ date: p.date, litres: p.value }));

  return (
    <div className="space-y-8">
      <RealtimeRefresher tables={["milk_sessions"]} farmId={farmId} />
      <h1 className="font-serif text-3xl text-ink">Milk production</h1>

      <Card>
        <CardHeader title="Production trend · 14 days" />
        <MilkTrendChart data={milkSeries} />
      </Card>

      <Card>
        <CardHeader title="Log a session" />
        <form action={logMilkSession} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <Input type="date" name="sessionDate" defaultValue={dates[dates.length - 1]} required />
          </Field>
          <Field label="Shift">
            <Select name="shift" required defaultValue="morning">
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </Select>
          </Field>
          <Field label="Litres">
            <Input type="number" name="litres" min="0" step="0.1" required />
          </Field>
          <Field label="Fat %">
            <Input type="number" name="fatPct" min="0" max="15" step="0.1" />
          </Field>
          <div className="lg:col-span-4">
            <Button type="submit">Log session</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-serif text-xl text-ink">Recent sessions</h2>
        </div>
        {recent.length === 0 ? (
          <div className="p-6">
            <EmptyState icon="🥛" title="No sessions yet" hint="Log your first milk session above." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Shift</th>
                <th className="px-6 py-3 font-medium">Litres</th>
                <th className="px-6 py-3 font-medium">Fat %</th>
                <th className="px-6 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-line transition hover:bg-surface">
                  <td className="px-6 py-3 font-mono text-xs text-ink-2">{r.session_date}</td>
                  <td className="px-6 py-3 capitalize text-ink">{r.shift}</td>
                  <td className="px-6 py-3 font-medium text-ink">{Number(r.litres).toFixed(1)}</td>
                  <td className={`px-6 py-3 ${fatClass(r.fat_pct)}`}>{r.fat_pct ?? "—"}</td>
                  <td className="px-6 py-3 font-mono text-xs text-ink-3">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
