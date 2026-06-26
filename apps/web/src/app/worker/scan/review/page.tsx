import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorker } from "@/lib/auth";
import { getScan } from "@/lib/scan";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ScanReviewTable } from "@/components/ScanReviewTable";
import { confirmFeedRows, confirmMilkRows } from "../actions";

export default async function WorkerScanReview({ searchParams }: { searchParams: Promise<{ scanId?: string }> }) {
  const session = await requireWorker();
  const { scanId } = await searchParams;
  if (!scanId) redirect("/worker/scan");
  const result = await getScan(scanId, session.profile.farm_id);

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <PageHeader title="Check the scan" subtitle="Fix anything we misread, then save." backHref="/worker/scan" />

      {!result || result.type === "other" ? (
        <Card>
          <EmptyState icon="🧾" title="Couldn't read this as a sheet" hint="Log it by hand from the home screen." />
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
          <EmptyState icon="₹" title="This looks like a bill" hint="Ask the owner to add expenses from the owner app." />
          <Link href="/worker" className="mt-3 inline-block text-sm font-semibold text-navy hover:underline">← Back to home</Link>
        </Card>
      )}
    </div>
  );
}
