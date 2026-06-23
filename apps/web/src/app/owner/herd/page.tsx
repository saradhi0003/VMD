import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui";
import { addAnimal } from "./actions";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "milking", label: "Milking" },
  { key: "dry", label: "Dry" },
  { key: "watch", label: "Watch" },
] as const;

function healthDot(health: string) {
  if (["observation", "treatment", "quarantine"].includes(health)) return "bg-warn";
  if (health === "healthy" || health === "recovered") return "bg-ok";
  return "bg-ink-3";
}

export default async function HerdPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const filter = (await searchParams).filter ?? "all";
  const supabase = await createSupabaseServer();

  let query = supabase.from("animals").select("*").eq("farm_id", farmId).order("name");
  if (filter === "milking") query = query.eq("status", "milking");
  else if (filter === "dry") query = query.eq("status", "dry");
  else if (filter === "watch") query = query.in("health", ["observation", "treatment", "quarantine"]);

  const { data: animals } = await query;
  const list = animals ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Names, not numbers</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">The herd</h1>
        <p className="mt-1 text-ink-2">Every animal has a name, a birthday and a health card.</p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/owner/herd?filter=${f.key}`}
            className={`rounded-pill px-3 py-1.5 text-sm font-medium transition ${
              filter === f.key ? "bg-surface-alt text-navy" : "border border-line text-ink-2 hover:bg-surface"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon="🐄" title="No animals here" hint="Add one below, or change the filter." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <Link
              key={a.id}
              href={`/owner/herd/${a.id}`}
              className="flex items-center gap-3 rounded-tile border border-line bg-white p-4 transition hover:border-navy/20"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-alt font-serif text-lg text-navy">
                {a.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-ink">{a.name}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${healthDot(a.health)}`} />
                </div>
                <div className="font-mono text-xs text-ink-2">
                  {a.tag} · <span className="capitalize">{a.type}</span> · <span className="capitalize">{a.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Add an animal" />
        <form action={addAnimal} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input name="name" required placeholder="e.g. Tulasi" />
          </Field>
          <Field label="Tag">
            <Input name="tag" required placeholder="e.g. VD-C07" />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue="cow">
              <option value="cow">Cow</option>
              <option value="buffalo">Buffalo</option>
              <option value="calf">Calf</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="milking">
              <option value="milking">Milking</option>
              <option value="dry">Dry</option>
              <option value="pregnant">Pregnant</option>
              <option value="calf">Calf</option>
            </Select>
          </Field>
          <Field label="Health">
            <Select name="health" defaultValue="healthy">
              <option value="healthy">Healthy</option>
              <option value="observation">Observation</option>
              <option value="treatment">Treatment</option>
              <option value="quarantine">Quarantine</option>
              <option value="recovered">Recovered</option>
            </Select>
          </Field>
          <Field label="Born (date)">
            <Input name="dob" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Add to herd</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
