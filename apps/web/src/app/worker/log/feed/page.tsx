import { requireWorker } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { Button, Card, Field, Input, Select, Textarea, PageHeader } from "@/components/ui";
import { logFeed } from "./actions";

const FEED_TYPES = ["Green fodder", "Dry fodder", "Concentrate / pellets", "Silage", "Mineral mix", "Other"];

export default async function WorkerLogFeedPage() {
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
      <PageHeader title="Log feed" subtitle="Record fodder or feed given." backHref="/worker" />
      <Card>
        <form action={logFeed} className="space-y-4">
          <Field label="Feed type">
            <Select name="feedType" required defaultValue="">
              <option value="" disabled>
                Choose feed…
              </option>
              {FEED_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity" hint="e.g. 20 kg, 3 buckets">
            <Input name="quantity" placeholder="Optional" />
          </Field>
          <Field label="Animal" hint="Leave blank for the whole herd.">
            <Select name="animalId" defaultValue="">
              <option value="">Whole herd</option>
              {(animals ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.tag}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note">
            <Textarea name="note" rows={2} placeholder="Optional" />
          </Field>
          <Button type="submit" className="w-full">
            Save feed log
          </Button>
        </form>
      </Card>
    </div>
  );
}
