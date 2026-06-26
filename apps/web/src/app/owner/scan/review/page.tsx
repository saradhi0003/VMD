import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { getScan } from "@/lib/scan";
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { ScanReviewTable } from "@/components/ScanReviewTable";
import { confirmExpense, confirmFeedRows, confirmMilkRows } from "../actions";

const isDate = (s: string | null | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function OwnerScanReview({ searchParams }: { searchParams: Promise<{ scanId?: string }> }) {
  const session = await requireOwner();
  const { scanId } = await searchParams;
  if (!scanId) redirect("/owner/scan");
  const result = await getScan(scanId, session.profile.farm_id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader title="Check the scan" subtitle="Fix anything we misread, then save." backHref="/owner/scan" />

      {!result || result.type === "other" ? (
        <Card>
          <EmptyState icon="🧾" title="Couldn't classify this document" hint="Enter it by hand on the relevant screen." />
          {result?.rawText && <p className="mt-3 whitespace-pre-wrap rounded-tile bg-surface p-3 font-mono text-xs text-ink-2">{result.rawText.slice(0, 600)}</p>}
        </Card>
      ) : result.type === "milk_sheet" ? (
        <Card>
          <p className="eyebrow mb-3">Milk sheet · {result.rows.length} rows read</p>
          <ScanReviewTable kind="milk" initial={result.rows} scanId={scanId} action={confirmMilkRows} />
        </Card>
      ) : result.type === "feed_sheet" ? (
        <Card>
          <p className="eyebrow mb-3">Feed sheet · {result.rows.length} rows read</p>
          <ScanReviewTable kind="feed" initial={result.rows} scanId={scanId} action={confirmFeedRows} />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Expense from receipt" />
          <form action={confirmExpense} className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input name="occurredAt" type="date" defaultValue={isDate(result.date) ? result.date! : today} />
            </Field>
            <Field label="Category">
              <Select name="category" defaultValue={result.category ?? "misc"}>
                <option value="feed">Feed</option>
                <option value="salaries">Salaries</option>
                <option value="medication">Medication</option>
                <option value="misc">Misc</option>
              </Select>
            </Field>
            <Field label="Amount (₹)">
              <Input name="amount" type="number" min="0" step="1" required defaultValue={result.amount ?? ""} />
            </Field>
            <Field label="Note">
              <Input name="description" defaultValue={[result.payee, result.description].filter(Boolean).join(" · ")} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Save expense</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
