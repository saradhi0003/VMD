import { requireWorker } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Button, Card, Field, Input, Select, PageHeader } from "@/components/ui";
import { logMilkFromWorker } from "./actions";

export default async function WorkerLogMilkPage({
  searchParams,
}: {
  searchParams: Promise<{
    litres?: string;
    fatPct?: string;
    shift?: string;
    animalId?: string;
    scanId?: string;
    voiceId?: string;
  }>;
}) {
  const session = await requireWorker();
  const sp = await searchParams;
  const supabase = await createSupabaseServer();

  const { data: milkingAnimals } = await supabase
    .from("animals")
    .select("id,name,tag")
    .eq("farm_id", session.profile.farm_id)
    .eq("status", "milking")
    .order("name");

  const fromCapture = Boolean(sp.scanId || sp.voiceId);
  const defaultShift =
    sp.shift === "morning" || sp.shift === "evening" ? sp.shift : new Date().getHours() < 12 ? "morning" : "evening";

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <PageHeader
        title="Log milk"
        subtitle={fromCapture ? "Check the details we read, then save." : undefined}
        backHref="/worker"
      />

      {fromCapture && (
        <div className="flex items-center gap-2 rounded-tile bg-surface-alt p-3 text-sm text-navy">
          <span aria-hidden>✦</span>
          <span>Pre-filled from your {sp.scanId ? "scan" : "voice note"} — please confirm.</span>
        </div>
      )}

      <Card>
        <form action={logMilkFromWorker} className="space-y-4">
          {sp.scanId && <input type="hidden" name="scanId" value={sp.scanId} />}
          {sp.voiceId && <input type="hidden" name="voiceId" value={sp.voiceId} />}

          <Field label="Animal">
            <Select name="animalId" required defaultValue={sp.animalId ?? ""}>
              <option value="" disabled>
                Choose animal…
              </option>
              {(milkingAnimals ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.tag}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shift">
            <Select name="shift" defaultValue={defaultShift}>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </Select>
          </Field>

          <Field label="Litres">
            <Input
              name="litres"
              type="number"
              min="0"
              step="0.1"
              required
              inputMode="decimal"
              defaultValue={sp.litres ?? ""}
            />
          </Field>

          <Field label="Fat %">
            <Input
              name="fatPct"
              type="number"
              min="0"
              max="15"
              step="0.1"
              inputMode="decimal"
              defaultValue={sp.fatPct ?? ""}
            />
          </Field>

          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </Card>
    </div>
  );
}
