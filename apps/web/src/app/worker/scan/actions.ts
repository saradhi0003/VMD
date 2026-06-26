"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorker } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { bulkInsertFeed, bulkInsertMilk, uploadAndScan } from "@/lib/scan";

/** Upload + classify any sheet, then hand off to the review screen. */
export async function processScan(formData: FormData) {
  const session = await requireWorker();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/worker/scan?error=no_image");
  }
  const { scanId } = await uploadAndScan(file, session.profile.farm_id, session.userId);
  if (!scanId) redirect("/worker/scan?error=scan_failed");
  redirect(`/worker/scan/review?scanId=${scanId}`);
}

const MilkRows = z.array(
  z.object({
    animal: z.string().nullable(),
    litres: z.number().nullable(),
    fatPct: z.number().nullable(),
    shift: z.enum(["morning", "evening"]).nullable(),
  }),
);

export async function confirmMilkRows(formData: FormData) {
  const session = await requireWorker();
  const scanId = z.string().uuid().parse(formData.get("scanId"));
  const rows = MilkRows.parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  const n = await bulkInsertMilk(session.profile.farm_id, session.userId, rows);
  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "scan_confirm", entity: "milk_session", entityId: scanId, diff: { count: n } });
  redirect("/worker?logged=milk");
}

const FeedRows = z.array(
  z.object({ feedType: z.string().nullable(), quantity: z.string().nullable(), animal: z.string().nullable() }),
);

export async function confirmFeedRows(formData: FormData) {
  const session = await requireWorker();
  const scanId = z.string().uuid().parse(formData.get("scanId"));
  const rows = FeedRows.parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  const n = await bulkInsertFeed(session.profile.farm_id, session.userId, rows);
  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "scan_confirm", entity: "activity_log:feed", entityId: scanId, diff: { count: n } });
  redirect("/worker?logged=feed");
}
