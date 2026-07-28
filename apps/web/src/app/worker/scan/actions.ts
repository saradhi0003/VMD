"use server";

import { redirect } from "next/navigation";
import { requireWorker } from "@/lib/auth";
import { confirmFeedFromScan, confirmMilkFromScan, runScanUpload } from "@/lib/scan";

/**
 * Worker half of the Smart Scan flow. The pipeline itself lives in `lib/scan.ts`
 * and is shared with `/owner/scan`; only the guard and the redirects differ.
 */

/** Upload + classify any sheet, then hand off to the review screen. */
export async function processScan(formData: FormData) {
  const session = await requireWorker();
  const out = await runScanUpload(session, formData);
  if (!out.ok) redirect(`/worker/scan?error=${out.code}`);
  redirect(`/worker/scan/review?scanId=${out.scanId}`);
}

export async function confirmMilkRows(formData: FormData) {
  const session = await requireWorker();
  await confirmMilkFromScan(session, formData);
  redirect("/worker?logged=milk");
}

export async function confirmFeedRows(formData: FormData) {
  const session = await requireWorker();
  await confirmFeedFromScan(session, formData);
  redirect("/worker?logged=feed");
}
