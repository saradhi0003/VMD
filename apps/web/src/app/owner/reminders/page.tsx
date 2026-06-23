import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui";
import { addReminder, markReminderDone } from "./actions";

const DAY = 86400000;
const typeDot: Record<string, string> = {
  doctor: "#3f93cf", vaccination: "#c2722f", fodder: "#1f8a5b", feed: "#1f8a5b", delivery: "#173a5c", other: "#8a96a0",
};

function priorityClass(p: string) {
  if (p === "high") return "text-warn font-medium";
  if (p === "medium") return "text-ink-2";
  return "text-ink-3";
}

export default async function RemindersPage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();

  const { data } = await supabase
    .from("reminders")
    .select("*")
    .eq("farm_id", farmId)
    .is("done_at", null)
    .order("due_at", { ascending: true });
  const reminders = data ?? [];

  const now = Date.now();
  const endToday = new Date().setHours(23, 59, 59, 999);
  const groups = {
    Today: reminders.filter((r) => new Date(r.due_at).getTime() <= endToday),
    "This week": reminders.filter((r) => {
      const t = new Date(r.due_at).getTime();
      return t > endToday && t <= now + 7 * DAY;
    }),
    Later: reminders.filter((r) => new Date(r.due_at).getTime() > now + 7 * DAY),
  };

  return (
    <div className="space-y-6">
      <RealtimeRefresher tables={["reminders"]} farmId={farmId} />
      <div>
        <p className="eyebrow">Reminders</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">What&apos;s coming up</h1>
        <p className="mt-1 text-ink-2">Vet visits, vaccinations, fodder and feed cycles.</p>
      </div>

      {reminders.length === 0 ? (
        <EmptyState icon="🎉" title="All clear" hint="No open reminders. Add one below." />
      ) : (
        (Object.keys(groups) as (keyof typeof groups)[]).map((g) =>
          groups[g].length === 0 ? null : (
            <section key={g}>
              <h2 className="eyebrow mb-2">{g}</h2>
              <ul className="space-y-2">
                {groups[g].map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-tile border border-line bg-white p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: typeDot[r.type] ?? "#8a96a0" }} />
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium text-ink">{r.title}</div>
                        <div className="font-mono text-xs text-ink-3">
                          {new Date(r.due_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          <span className={`ml-2 capitalize ${priorityClass(r.priority)}`}>{r.priority}</span>
                          <span className="ml-2 capitalize text-ink-3">· {r.type}</span>
                        </div>
                      </div>
                    </div>
                    <form action={markReminderDone}>
                      <input type="hidden" name="reminderId" value={r.id} />
                      <button
                        type="submit"
                        aria-label="Mark done"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-navy/30 text-navy transition hover:bg-navy hover:text-white"
                      >
                        ✓
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ),
        )
      )}

      <Card>
        <CardHeader title="Add a reminder" />
        <form action={addReminder} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="What">
            <Input name="title" required placeholder="e.g. Vet check — Ganga" />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue="other">
              <option value="doctor">Doctor / vet</option>
              <option value="vaccination">Vaccination</option>
              <option value="fodder">Fodder</option>
              <option value="feed">Feed</option>
              <option value="delivery">Delivery</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="medium">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="When">
            <Input name="dueAt" type="datetime-local" required />
          </Field>
          <div className="lg:col-span-4"><Button type="submit">Add reminder</Button></div>
        </form>
      </Card>
    </div>
  );
}
