import { requireOwner } from "@/lib/auth";
import { Card } from "@/components/ui";
import { ScanUploader } from "@/components/ScanUploader";
import { processScan } from "./actions";

export default async function OwnerScanPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Smart Scan</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Scan a sheet or a bill</h1>
        <p className="mt-1 text-ink-2">Milk sheet, feed sheet, or an expense receipt — we read it, you confirm.</p>
      </div>
      {sp.error === "no_image" && <p className="rounded-tile bg-warn/10 p-3 text-sm text-warn">Please choose a photo first.</p>}
      {sp.error === "scan_failed" && <p className="rounded-tile bg-warn/10 p-3 text-sm text-warn">Could not read that image — try a clearer photo.</p>}
      <Card className="max-w-md">
        <ScanUploader action={processScan} hint="milk sheet · feed sheet · bill/receipt · or gallery" />
      </Card>
    </div>
  );
}
