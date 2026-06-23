import { requireOwner } from "@/lib/auth";
import { Button, Card, Textarea } from "@/components/ui";
import { askAssistant } from "./actions";

const EXAMPLES = [
  "Lakshmi 7.2 litres morning, fat 4.3",
  "Ganga gave 6 litres this evening",
  "Saraswati 8 litres, fat 4.5",
];

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireOwner();
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow">AI assistant</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Just tell me what happened</h1>
        <p className="mt-1 text-ink-2">Type it in plain words — I&apos;ll turn it into a logged milk entry.</p>
      </div>

      {sp.ok && (
        <div className="flex items-center gap-2 rounded-tile bg-ok/10 px-4 py-3 text-sm font-medium text-ok" aria-live="polite">
          <span aria-hidden>✓</span> {sp.ok}
        </div>
      )}
      {sp.err && (
        <div className="rounded-tile bg-warn/10 px-4 py-3 text-sm text-warn" aria-live="polite">{sp.err}</div>
      )}

      <Card>
        {/* a bot bubble, for the chat feel */}
        <div className="mb-4 max-w-[85%] rounded-tile rounded-bl-sm bg-surface p-3 text-sm text-ink-2">
          <span className="font-semibold text-navy">Assistant</span>
          <p className="mt-1">Tell me the animal, the litres, the shift, and fat % if you have it.</p>
        </div>
        <form action={askAssistant} className="space-y-3">
          <Textarea name="text" rows={3} required placeholder='e.g. "Lakshmi 7 litres morning, fat 4.2"' />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Plain text → entry</span>
            <Button type="submit">Save from text</Button>
          </div>
        </form>
      </Card>

      <div>
        <p className="eyebrow mb-2">Try saying</p>
        <ul className="space-y-2">
          {EXAMPLES.map((e) => (
            <li key={e} className="rounded-tile border border-line bg-white px-4 py-3 font-mono text-sm text-ink-2">“{e}”</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
