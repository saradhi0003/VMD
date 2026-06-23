import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { Sparkline } from "@/components/charts/lazy";

const healthTone: Record<string, string> = {
  healthy: "bg-ok/10 text-ok",
  recovered: "bg-ok/10 text-ok",
  observation: "bg-warn/10 text-warn",
  treatment: "bg-warn/10 text-warn",
  quarantine: "bg-warn/10 text-warn",
};

export default async function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: animal } = await supabase.from("animals").select("*").eq("farm_id", farmId).eq("id", id).maybeSingle();
  if (!animal) notFound();

  const [eventsRes, yieldRes] = await Promise.all([
    supabase.from("animal_health_events").select("*").eq("animal_id", id).order("occurred_at", { ascending: false }).limit(20),
    supabase.from("milk_sessions").select("session_date,litres").eq("animal_id", id).order("session_date", { ascending: true }).limit(30),
  ]);
  const events = eventsRes.data ?? [];
  const yields = (yieldRes.data ?? []).map((r) => Number(r.litres));

  return (
    <div className="space-y-6">
      <PageHeader title={animal.name} subtitle={`${animal.tag} · ${animal.type}`} backHref="/owner/herd" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="eyebrow">Status</div>
          <div className="mt-1 font-serif text-2xl capitalize text-ink">{animal.status}</div>
        </Card>
        <Card>
          <div className="eyebrow">Health</div>
          <span className={`mt-2 inline-block rounded-pill px-2.5 py-0.5 text-sm font-medium capitalize ${healthTone[animal.health] ?? "bg-surface-alt text-ink-2"}`}>
            {animal.health}
          </span>
        </Card>
        <Card>
          <div className="eyebrow">Born</div>
          <div className="mt-1 font-mono text-sm text-ink">
            {animal.dob ? new Date(animal.dob).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Yield history" />
        {yields.length === 0 ? (
          <EmptyState icon="🥛" title="No per-animal yield yet" hint="Logged when a worker records milk against this animal." />
        ) : (
          <div className="h-16">
            <Sparkline data={yields} color="#3f93cf" />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Feed plan" />
        <p className="text-[15px] text-ink-2">{animal.notes || "No feed notes recorded."}</p>
      </Card>

      <Card>
        <CardHeader title="Health card" />
        {events.length === 0 ? (
          <EmptyState icon="🩺" title="No health events" hint="Treatments and observations appear here." />
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="rounded-tile border border-line p-4">
                <div className="flex items-center justify-between">
                  <strong className="text-ink">{e.kind}</strong>
                  <span className="font-mono text-xs text-ink-3">
                    {new Date(e.occurred_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                {e.details && <p className="mt-1 text-sm text-ink-2">{e.details}</p>}
                {(e.vet_name || e.medication) && (
                  <p className="mt-1 font-mono text-xs text-ink-3">
                    {[e.vet_name && `vet: ${e.vet_name}`, e.medication && `med: ${e.medication}`].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
