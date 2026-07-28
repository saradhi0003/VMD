import { scanDocument, type ScanFeedRow, type ScanMilkRow, type ScanResult } from "@vmd/llm";
import { z } from "zod";
import { createSupabaseServer } from "./supabase-server";
import { recordAudit } from "./audit";
import { UploadError, validateUpload } from "./upload";
import type { SessionContext } from "./auth";

const today = () => new Date().toISOString().slice(0, 10);
const defaultShift = (): "morning" | "evening" => (new Date().getHours() < 12 ? "morning" : "evening");

/** Upload the image to Storage, run vision classify+extract, persist a `scan_events` row. */
export async function uploadAndScan(
  file: File,
  farmId: string,
  userId: string,
): Promise<{ scanId: string | null; result: ScanResult }> {
  const supabase = await createSupabaseServer();
  const bytes = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const ext = mediaType === "image/png" ? "png" : "jpg";
  const path = `${farmId}/scans/${crypto.randomUUID()}.${ext}`;

  await supabase.storage.from("photos").upload(path, bytes, { contentType: mediaType, upsert: false });

  let result: ScanResult;
  try {
    result = await scanDocument(bytes.toString("base64"), mediaType);
  } catch (err) {
    console.error("[scan] extraction failed", err);
    result = { type: "other", confidence: 0, rawText: "", title: null };
  }

  const { data } = await supabase
    .from("scan_events")
    .insert({
      farm_id: farmId,
      user_id: userId,
      image_url: path,
      ocr_text: result.rawText || null,
      parsed: result as unknown,
      confidence: result.confidence,
    })
    .select("id")
    .single();

  return { scanId: data?.id ?? null, result };
}

/** Bulk-insert confirmed milk-sheet rows; resolves written animal names/tags to ids. Returns count. */
export async function bulkInsertMilk(farmId: string, userId: string, rows: ScanMilkRow[]): Promise<number> {
  const valid = rows.filter((r) => r.litres != null && r.litres > 0);
  if (!valid.length) return 0;

  const supabase = await createSupabaseServer();
  const { data: animals } = await supabase.from("animals").select("id,name,tag").eq("farm_id", farmId);
  const list = animals ?? [];
  const findAnimal = (w: string | null) => {
    if (!w) return null;
    const low = w.toLowerCase();
    return list.find((a) => a.name.toLowerCase() === low || a.tag.toLowerCase() === low)?.id ?? null;
  };

  const inserts = valid.map((r) => ({
    farm_id: farmId,
    session_date: today(),
    shift: r.shift ?? defaultShift(),
    animal_id: findAnimal(r.animal),
    litres: r.litres!.toFixed(2),
    fat_pct: r.fatPct ?? null,
    milker_id: userId,
    source: "scan",
  }));

  const { error } = await supabase.from("milk_sessions").insert(inserts);
  if (error) throw new Error(error.message);
  return inserts.length;
}

/** Bulk-insert confirmed feed-sheet rows into activity_logs. Returns count. */
export async function bulkInsertFeed(farmId: string, userId: string, rows: ScanFeedRow[]): Promise<number> {
  const valid = rows.filter((r) => r.feedType);
  if (!valid.length) return 0;

  const supabase = await createSupabaseServer();
  const inserts = valid.map((r) => ({
    farm_id: farmId,
    user_id: userId,
    kind: "feed",
    note: r.quantity ?? null,
    payload: { feedType: r.feedType, quantity: r.quantity, animal: r.animal } as unknown,
  }));

  const { error } = await supabase.from("activity_logs").insert(inserts);
  if (error) throw new Error(error.message);
  return inserts.length;
}

/* ──────────────────────────────────────────────────────────
   Shared scan-flow steps.

   `/owner/scan` and `/worker/scan` run the identical pipeline and differ only
   in which guard they call and where they redirect afterwards. These helpers
   hold the common half so the two `"use server"` files stay thin.

   Redirects deliberately stay in the route actions: `redirect()` works by
   throwing, so keeping it visible at the call site avoids a helper silently
   swallowing (or triggering) control flow the reader can't see.
─────────────────────────────────────────────────────────── */

export const ScanMilkRows = z.array(
  z.object({
    animal: z.string().nullable(),
    litres: z.number().nullable(),
    fatPct: z.number().nullable(),
    shift: z.enum(["morning", "evening"]).nullable(),
  }),
);

export const ScanFeedRows = z.array(
  z.object({
    feedType: z.string().nullable(),
    quantity: z.string().nullable(),
    animal: z.string().nullable(),
  }),
);

export type ScanUploadOutcome =
  | { ok: true; scanId: string }
  | { ok: false; code: string };

/**
 * Validate → upload → classify. Returns an outcome instead of redirecting so
 * each route can send the user to its own error/review URL.
 */
export async function runScanUpload(
  session: SessionContext,
  formData: FormData,
): Promise<ScanUploadOutcome> {
  let file: File;
  try {
    file = validateUpload(formData.get("image"), session.userId);
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, code: err.code };
    throw err;
  }

  const { scanId } = await uploadAndScan(file, session.profile.farm_id, session.userId);
  return scanId ? { ok: true, scanId } : { ok: false, code: "scan_failed" };
}

/** Parse + insert confirmed milk rows, with the audit entry. Returns the row count. */
export async function confirmMilkFromScan(
  session: SessionContext,
  formData: FormData,
): Promise<number> {
  const scanId = z.string().uuid().parse(formData.get("scanId"));
  const rows = ScanMilkRows.parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  const n = await bulkInsertMilk(session.profile.farm_id, session.userId, rows);
  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "scan_confirm",
    entity: "milk_session",
    entityId: scanId,
    diff: { count: n },
  });
  return n;
}

/** Parse + insert confirmed feed rows, with the audit entry. Returns the row count. */
export async function confirmFeedFromScan(
  session: SessionContext,
  formData: FormData,
): Promise<number> {
  const scanId = z.string().uuid().parse(formData.get("scanId"));
  const rows = ScanFeedRows.parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  const n = await bulkInsertFeed(session.profile.farm_id, session.userId, rows);
  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "scan_confirm",
    entity: "activity_log:feed",
    entityId: scanId,
    diff: { count: n },
  });
  return n;
}

/** Fetch a stored scan result for the review screen. */
export async function getScan(scanId: string, farmId: string): Promise<ScanResult | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("scan_events")
    .select("parsed")
    .eq("id", scanId)
    .eq("farm_id", farmId)
    .maybeSingle();
  return (data?.parsed as ScanResult | undefined) ?? null;
}
