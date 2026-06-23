import { requireWorker } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Button, Card, Field, Input, Select, Textarea, PageHeader } from "@/components/ui";
import { logHealthEvent } from "./actions";

const KINDS = ["Illness", "Treatment", "Vaccination", "Injury", "Heat / breeding", "Recovered", "Other"];

export default async function WorkerLogHealthPage() {
  const session = await requireWorker();
  const supabase = await createSupabaseServer();

  const { data: animals } = await supabase
    .from("animals")
    .select("id,name,tag")
    .eq("farm_id", session.profile.farm_id)
    .not("status", "in", "(sold,deceased)")
    .order("name");

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <PageHeader title="Log health" subtitle="Record an illness, treatment or vaccination." backHref="/worker" />
      <Card>
        <form action={logHealthEvent} className="space-y-4">
          <Field label="Animal">
            <Select name="animalId" required defaultValue="">
              <option value="" disabled>
                Choose animal…
              </option>
              {(animals ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.tag}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select name="kind" required defaultValue="">
              <option value="" disabled>
                Choose type…
              </option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Details" hint="What did you observe or do?">
            <Textarea name="details" rows={3} placeholder="e.g. Slight limp on left hind leg" />
          </Field>
          <Field label="Vet name">
            <Input name="vetName" placeholder="Optional" />
          </Field>
          <Field label="Medication">
            <Input name="medication" placeholder="Optional" />
          </Field>
          <Field label="Milk withdrawal until" hint="If medicated — milk not for sale until this date.">
            <Input name="withdrawalUntil" type="date" />
          </Field>
          <Button type="submit" className="w-full">
            Save health log
          </Button>
        </form>
      </Card>
    </div>
  );
}
