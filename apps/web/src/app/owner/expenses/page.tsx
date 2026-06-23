import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Button, Card, CardHeader, EmptyState, Field, Input, Select, Textarea, StatCard } from "@/components/ui";
import { addExpense } from "./actions";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const DAY = 86400000;
const CATS = ["salaries", "medication", "feed", "misc"] as const;
const catColor: Record<string, string> = { salaries: "#173a5c", medication: "#3f93cf", feed: "#1f8a5b", misc: "#c2722f" };

export default async function ExpensesPage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();
  const monthStart = new Date(Date.now() - 30 * DAY).toISOString();

  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("farm_id", farmId)
    .gte("occurred_at", monthStart)
    .order("occurred_at", { ascending: false });
  const expenses = data ?? [];

  const total = expenses.reduce((a, e) => a + e.amount_minor, 0) / 100;
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount_minor / 100);
  const maxCat = Math.max(1, ...byCat.values());

  return (
    <div className="space-y-6">
      <RealtimeRefresher tables={["expenses"]} farmId={farmId} />
      <div>
        <p className="eyebrow">Costs &amp; expenses</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Where the money goes</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Spent · 30 days" value={rupees.format(total)} icon="🧾" accent="warn" />
        <StatCard label="Entries" value={String(expenses.length)} icon="📋" accent="navy" />
      </section>

      <Card>
        <CardHeader title="By category · 30 days" />
        {byCat.size === 0 ? (
          <EmptyState icon="📊" title="No expenses yet" hint="Add one below." />
        ) : (
          <ul className="space-y-3">
            {CATS.filter((c) => byCat.has(c)).map((c) => {
              const v = byCat.get(c) ?? 0;
              return (
                <li key={c}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="capitalize text-ink">{c}</span>
                    <span className="font-mono text-ink-2">{rupees.format(v)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-surface">
                    <div className="h-full rounded-pill" style={{ width: `${(v / maxCat) * 100}%`, background: catColor[c] }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Log a cost" />
        <form action={addExpense} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <Input name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Category">
            <Select name="category" defaultValue="feed">
              {CATS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </Select>
          </Field>
          <Field label="Amount (₹)">
            <Input name="amount" type="number" min="0" step="1" required />
          </Field>
          <Field label="Note">
            <Input name="description" placeholder="Optional" />
          </Field>
          <div className="lg:col-span-4"><Button type="submit">Save cost</Button></div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-6 py-4"><h2 className="font-serif text-xl text-ink">Recent costs</h2></div>
        {expenses.length === 0 ? (
          <div className="p-6"><EmptyState icon="🧾" title="Nothing logged" hint="Add your first cost above." /></div>
        ) : (
          <ul className="divide-y divide-line">
            {expenses.slice(0, 15).map((e) => (
              <li key={e.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <div className="text-sm font-medium capitalize text-ink">{e.category}</div>
                  <div className="font-mono text-xs text-ink-3">
                    {new Date(e.occurred_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {e.description ? ` · ${e.description}` : ""}
                  </div>
                </div>
                <span className="font-mono text-sm text-ink">{rupees.format(e.amount_minor / 100)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
