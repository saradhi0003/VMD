"use server";

import { redirect } from "next/navigation";
import { extractMilkFromImage, type MilkExtraction } from "@vmd/llm";
import { requireWorker } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Smart Scan: store the milk-slip photo, OCR/parse it with Claude vision, record
 * a `scan_events` row, then hand off to the milk form pre-filled with what we read.
 * Degrades gracefully (manual entry) when the LLM is unconfigured or parsing fails.
 */
export async function scanMilkSlip(formData: FormData) {
  const session = await requireWorker();
  const farmId = session.profile.farm_id;
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/worker/scan?error=no_image");
  }

  const supabase = await createSupabaseServer();
  const bytes = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const ext = mediaType === "image/png" ? "png" : "jpg";
  const path = `${farmId}/scans/${crypto.randomUUID()}.${ext}`;

  await supabase.storage.from("photos").upload(path, bytes, { contentType: mediaType, upsert: false });

  let parsed: MilkExtraction;
  try {
    parsed = await extractMilkFromImage(bytes.toString("base64"), mediaType);
  } catch (err) {
    console.error("[scan] extraction failed", err);
    parsed = { litres: null, fatPct: null, animalTag: null, animalName: null, shift: null, rawText: "", confidence: 0 };
  }

  // Map a recognised tag to an animal in this farm.
  let animalId: string | null = null;
  if (parsed.animalTag) {
    const { data: animal } = await supabase
      .from("animals")
      .select("id")
      .eq("farm_id", farmId)
      .ilike("tag", parsed.animalTag)
      .maybeSingle();
    animalId = animal?.id ?? null;
  }

  const { data: scan } = await supabase
    .from("scan_events")
    .insert({
      farm_id: farmId,
      user_id: session.userId,
      image_url: path,
      ocr_text: parsed.rawText || null,
      parsed: parsed as unknown,
      confidence: parsed.confidence,
    })
    .select("id")
    .single();

  const qs = new URLSearchParams();
  if (parsed.litres != null) qs.set("litres", String(parsed.litres));
  if (parsed.fatPct != null) qs.set("fatPct", String(parsed.fatPct));
  if (parsed.shift) qs.set("shift", parsed.shift);
  if (animalId) qs.set("animalId", animalId);
  if (scan?.id) qs.set("scanId", scan.id);

  redirect(`/worker/log/milk?${qs.toString()}`);
}
