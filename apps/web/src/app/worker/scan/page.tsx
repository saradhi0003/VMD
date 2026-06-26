import { requireWorker } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ScanUploader } from "@/components/ScanUploader";
import { processScan } from "./actions";

export default async function WorkerScanPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireWorker();
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <PageHeader title="Smart Scan" subtitle="Snap the day's milk or feed sheet — we'll read every row." backHref="/worker" />
      {sp.error === "no_image" && <p className="rounded-tile bg-warn/10 p-3 text-sm text-warn">Please choose a photo first.</p>}
      {sp.error === "scan_failed" && <p className="rounded-tile bg-warn/10 p-3 text-sm text-warn">Could not read that image — try a clearer photo.</p>}
      <Card>
        <ScanUploader action={processScan} />
      </Card>
    </div>
  );
}
