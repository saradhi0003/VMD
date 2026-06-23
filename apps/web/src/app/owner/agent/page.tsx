import { requireOwner } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { Button, Card, EmptyState } from "@/components/ui";
import { FindingCard } from "@/components/FindingCard";
import { triggerDailyAgent } from "./actions";

export default async function AgentPage() {
  const session = await requireOwner();
  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();

  const [latestRunRes, findingsRes] = await Promise.all([
    supabase.from("agent_runs").select("*").eq("farm_id", farmId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("agent_findings").select("*").eq("farm_id", farmId).eq("dismissed", false).order("created_at", { ascending: false }).limit(50),
  ]);

  const latestRun = latestRunRes.data;
  const findings = findingsRes.data ?? [];

  return (
    <div className="space-y-6">
      <RealtimeRefresher tables={["agent_findings", "agent_runs"]} farmId={farmId} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">AI farm-check</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">What needs a look today</h1>
          <p className="mt-1 text-ink-2">
            Runs daily at 6 AM IST.{" "}
            {latestRun ? `Last run ${new Date(latestRun.started_at).toLocaleString("en-IN")}` : "Not run yet."}
          </p>
        </div>
        <form action={triggerDailyAgent}>
          <Button type="submit">Run now</Button>
        </form>
      </div>

      <Card>
        {findings.length === 0 ? (
          <EmptyState icon="✅" title="No open findings" hint="Everything looks healthy. Run the agent or check back tomorrow." />
        ) : (
          <ul className="space-y-3">
            {findings.map((f) => (
              <FindingCard key={f.id} finding={f} showConfidence />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
