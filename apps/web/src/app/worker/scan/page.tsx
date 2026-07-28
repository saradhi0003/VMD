import { requireWorker } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ScanUploader } from "@/components/ScanUploader";
import { SCAN_ERROR_MESSAGES } from "@/lib/upload";
import { processScan } from "./actions";

export default async function WorkerScanPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireWorker();
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <PageHeader title="Smart Scan" subtitle="Snap the day's milk or feed sheet — we'll read every row." backHref="/worker" />
      {sp.error && SCAN_ERROR_MESSAGES[sp.error] && (
        <p className="rounded-tile bg-warn/10 p-3 text-sm text-warn">{SCAN_ERROR_MESSAGES[sp.error]}</p>
      )}
      <Card>
        <ScanUploader action={processScan} />
      </Card>
    </div>
  );
}
