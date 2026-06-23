import { createServiceClient } from "@vmd/supabase";
import type { FarmSnapshot } from "@vmd/llm";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function buildFarmSnapshot(farmId: string, forDate: string): Promise<FarmSnapshot> {
  const supabase = createServiceClient();

  const { data: farm } = await supabase.from("farms").select("name").eq("id", farmId).single();
  if (!farm) throw new Error(`unknown farm ${farmId}`);

  const today = new Date(`${forDate}T00:00:00Z`);
  const yesterday = new Date(today.getTime() - ONE_DAY_MS);
  const yISO = isoDate(yesterday);
  const start7ISO = isoDate(new Date(today.getTime() - 7 * ONE_DAY_MS));

  /* Yesterday's sessions */
  const { data: ySessions } = await supabase
    .from("milk_sessions")
    .select("shift,litres,fat_pct")
    .eq("farm_id", farmId)
    .eq("session_date", yISO);

  const morning = (ySessions ?? []).filter((s) => s.shift === "morning").reduce((a, s) => a + Number(s.litres), 0);
  const evening = (ySessions ?? []).filter((s) => s.shift === "evening").reduce((a, s) => a + Number(s.litres), 0);
  const fatVals = (ySessions ?? []).map((s) => s.fat_pct).filter((n): n is number => n != null);
  const yesterdayFat = fatVals.length ? Math.round((fatVals.reduce((a, b) => a + b, 0) / fatVals.length) * 10) / 10 : null;

  /* Last 7 days */
  const { data: last7Raw } = await supabase
    .from("milk_sessions")
    .select("session_date,litres,fat_pct")
    .eq("farm_id", farmId)
    .gte("session_date", start7ISO)
    .lte("session_date", isoDate(today));

  const byDate = new Map<string, { total: number; fatVals: number[] }>();
  for (const row of last7Raw ?? []) {
    const k = row.session_date;
    const entry = byDate.get(k) ?? { total: 0, fatVals: [] };
    entry.total += Number(row.litres);
    if (row.fat_pct != null) entry.fatVals.push(row.fat_pct);
    byDate.set(k, entry);
  }
  const last7Days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      total: Math.round(v.total * 10) / 10,
      fatPct: v.fatVals.length ? Math.round((v.fatVals.reduce((a, b) => a + b, 0) / v.fatVals.length) * 10) / 10 : null,
    }));

  /* Missing entries */
  const missing: FarmSnapshot["missingEntries"] = [];
  for (const shift of ["morning", "evening"] as const) {
    if (!(ySessions ?? []).some((s) => s.shift === shift)) missing.push({ date: yISO, shift });
  }

  /* Upcoming reminders */
  const { data: upcoming } = await supabase
    .from("reminders")
    .select("due_at,title,priority")
    .eq("farm_id", farmId)
    .is("done_at", null)
    .gte("due_at", today.toISOString())
    .lte("due_at", new Date(today.getTime() + 7 * ONE_DAY_MS).toISOString())
    .order("due_at", { ascending: true });

  /* Quiet customers — get all + last sale per customer */
  const { data: customers } = await supabase
    .from("customers")
    .select("id,name")
    .eq("farm_id", farmId)
    .eq("is_active", true);

  const quietCustomers: FarmSnapshot["quietCustomers"] = [];
  for (const c of customers ?? []) {
    const { data: lastSale } = await supabase
      .from("sales")
      .select("occurred_at")
      .eq("customer_id", c.id)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const daysSince = lastSale
      ? Math.floor((today.getTime() - new Date(lastSale.occurred_at).getTime()) / ONE_DAY_MS)
      : 999;
    if (daysSince >= 10) quietCustomers.push({ name: c.name, daysSinceLastOrder: daysSince });
  }
  quietCustomers.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

  /* Recent health events */
  const { data: healthRaw } = await supabase
    .from("animal_health_events")
    .select("kind,occurred_at,animals(name,farm_id)")
    .gte("occurred_at", new Date(today.getTime() - 14 * ONE_DAY_MS).toISOString())
    .order("occurred_at", { ascending: false })
    .limit(20);

  const recentHealthEvents = (healthRaw ?? [])
    .filter((h) => {
      const a = h.animals as unknown as { farm_id: string } | null;
      return a?.farm_id === farmId;
    })
    .slice(0, 10)
    .map((h) => {
      const animal = (h.animals as unknown as { name: string } | null)?.name ?? "unknown";
      return {
        animal,
        kind: h.kind,
        daysAgo: Math.floor((today.getTime() - new Date(h.occurred_at).getTime()) / ONE_DAY_MS),
      };
    });

  return {
    farmName: farm.name,
    today: forDate,
    yesterday: { morning: morning || null, evening: evening || null, fatPct: yesterdayFat },
    last7Days,
    missingEntries: missing,
    upcomingReminders: (upcoming ?? []).map((r) => ({ dueAt: r.due_at, title: r.title, priority: r.priority })),
    quietCustomers: quietCustomers.slice(0, 10),
    recentHealthEvents,
  };
}
