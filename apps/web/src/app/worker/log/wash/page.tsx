import { requireWorker } from "@/lib/auth";
import { Button, Card, Field, Textarea, PageHeader } from "@/components/ui";
import { logWash } from "./actions";

const AREAS = ["Milking parlour", "Utensils / cans", "Animal shed", "Water troughs", "Whole farm"];

export default async function WorkerLogWashPage() {
  await requireWorker();

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <PageHeader title="Wash done" subtitle="Confirm cleaning is complete." backHref="/worker" />
      <Card>
        <form action={logWash} className="space-y-3">
          <p className="text-sm text-stone-500">Tap the area you cleaned.</p>
          {AREAS.map((area) => (
            <button
              key={area}
              type="submit"
              name="area"
              value={area}
              className="flex min-h-[60px] w-full items-center justify-between rounded-tile border border-line bg-white px-4 py-4 text-left text-base font-semibold text-ink transition hover:border-navy/30 hover:bg-surface active:scale-[.99]"
            >
              <span>{area}</span>
              <span aria-hidden className="text-navy">
                ✓
              </span>
            </button>
          ))}
          <Field label="Note">
            <Textarea name="note" rows={2} placeholder="Optional" />
          </Field>
          <p className="text-xs text-ink-3">Tip: leave a note then tap an area above to save.</p>
          <Button type="submit" name="area" value="Whole farm" variant="secondary" className="w-full">
            Mark whole farm washed
          </Button>
        </form>
      </Card>
    </div>
  );
}
