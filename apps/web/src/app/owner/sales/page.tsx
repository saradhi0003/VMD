import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Button, Card, CardHeader, EmptyState, Field, Input, Select, StatCard } from "@/components/ui";
import { addCustomer, addSale } from "./actions";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const DAY = 86400000;

export default async function SalesPage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const start30 = new Date(Date.now() - 30 * DAY).toISOString();

  const [customersRes, productsRes, salesRes] = await Promise.all([
    supabase.from("customers").select("*").eq("farm_id", farmId).order("name"),
    supabase.from("products").select("*").eq("farm_id", farmId).eq("is_active", true).order("name"),
    supabase.from("sales").select("*").eq("farm_id", farmId).gte("occurred_at", start30).order("occurred_at", { ascending: false }),
  ]);
  const customers = customersRes.data ?? [];
  const products = productsRes.data ?? [];
  const sales = salesRes.data ?? [];

  const custName = new Map(customers.map((c) => [c.id, c.name]));
  const prodName = new Map(products.map((p) => [p.id, p.name]));

  const todayTotal = sales.filter((s) => s.occurred_at.slice(0, 10) === today).reduce((a, s) => a + s.amount_minor, 0) / 100;
  const weekStart = new Date(Date.now() - 7 * DAY).toISOString();
  const weekTotal = sales.filter((s) => s.occurred_at >= weekStart).reduce((a, s) => a + s.amount_minor, 0) / 100;

  const lastOrder = new Map<string, string>();
  for (const s of sales) {
    if (!s.customer_id) continue;
    const prev = lastOrder.get(s.customer_id);
    if (!prev || s.occurred_at > prev) lastOrder.set(s.customer_id, s.occurred_at);
  }
  const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);

  return (
    <div className="space-y-6">
      <RealtimeRefresher tables={["sales", "customers"]} farmId={farmId} />
      <div>
        <p className="eyebrow">Sales &amp; customers</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Who we sold to</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Sales today" value={rupees.format(todayTotal)} icon="₹" accent="navy" />
        <StatCard label="Sales · 7 days" value={rupees.format(weekTotal)} icon="📈" accent="blue" />
      </section>

      <Card>
        <CardHeader title="Log a sale" />
        {customers.length === 0 || products.length === 0 ? (
          <EmptyState icon="🧾" title="Add a customer first" hint="Use the form below to add your first customer." />
        ) : (
          <form action={addSale} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Customer">
              <Select name="customerId" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Product">
              <Select name="productId" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {rupees.format(p.price_minor / 100)}/{p.unit}</option>)}
              </Select>
            </Field>
            <Field label="Quantity">
              <Input name="qty" type="number" min="0" step="0.5" required />
            </Field>
            <Field label="Date">
              <Input name="occurredAt" type="date" defaultValue={today} required />
            </Field>
            <div className="lg:col-span-4"><Button type="submit">Save sale</Button></div>
          </form>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-6 py-4"><h2 className="font-serif text-xl text-ink">Recent sales</h2></div>
          {sales.length === 0 ? (
            <div className="p-6"><EmptyState icon="🧾" title="No sales yet" hint="Log one above." /></div>
          ) : (
            <ul className="divide-y divide-line">
              {sales.slice(0, 12).map((s) => (
                <li key={s.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{custName.get(s.customer_id ?? "") ?? "—"}</div>
                    <div className="font-mono text-xs text-ink-3">
                      {new Date(s.occurred_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {prodName.get(s.product_id ?? "") ?? "—"} · {Number(s.qty)}
                    </div>
                  </div>
                  <span className="font-mono text-sm text-ink">{rupees.format(s.amount_minor / 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Customers" />
          {customers.length === 0 ? (
            <EmptyState icon="🧑‍🌾" title="No customers yet" hint="Add one below." />
          ) : (
            <ul className="space-y-2">
              {customers.map((c) => {
                const d = daysSince(lastOrder.get(c.id));
                const quiet = d === null || d > 10;
                return (
                  <li key={c.id} className="flex items-center justify-between rounded-tile border border-line p-3">
                    <div>
                      <div className="text-sm font-medium text-ink">{c.name}</div>
                      <div className="font-mono text-xs text-ink-3">{c.route ?? c.phone ?? "—"}</div>
                    </div>
                    <span className={`font-mono text-xs ${quiet ? "text-warn" : "text-ink-2"}`}>
                      {d === null ? "no orders" : d === 0 ? "today" : `${d}d ago`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={addCustomer} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
            <Input name="name" required placeholder="Name" />
            <Input name="phone" placeholder="Phone (optional)" />
            <Input name="route" placeholder="Route (optional)" />
            <div className="sm:col-span-3"><Button type="submit" variant="secondary">Add customer</Button></div>
          </form>
        </Card>
      </div>
    </div>
  );
}
