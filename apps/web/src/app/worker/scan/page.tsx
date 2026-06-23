import { requireWorker } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ScanForm } from "./ScanForm";

export default async function WorkerScanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireWorker();
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <PageHeader title="Smart Scan" subtitle="Snap a milk slip — we'll read it for you." backHref="/worker" />
      {sp.error === "no_image" && (
        <p className="rounded-tile bg-warn/10 p-3 text-sm text-warn">Please choose a photo first.</p>
      )}
      <Card>
        <ScanForm />
      </Card>
    </div>
  );
}
