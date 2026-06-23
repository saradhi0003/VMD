"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { extractMilkFromText, type MilkExtraction } from "@vmd/llm";
import { requireWorker } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";

const Input = z.object({ transcript: z.string().min(1).max(2000) });

/**
 * Voice entry: parse a spoken/typed milk entry with Claude, record a
 * `voice_entries` row, then hand off to the milk form pre-filled for confirmation.
 */
export async function processVoice(formData: FormData) {
  const session = await requireWorker();
  const farmId = session.profile.farm_id;
  const { transcript } = Input.parse({ transcript: formData.get("transcript") });

  let parsed: MilkExtraction;
  try {
    parsed = await extractMilkFromText(transcript);
  } catch (err) {
    console.error("[voice] extraction failed", err);
    parsed = { litres: null, fatPct: null, animalTag: null, animalName: null, shift: null, rawText: transcript, confidence: 0 };
  }

  const supabase = await createSupabaseServer();

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

  const { data: entry } = await supabase
    .from("voice_entries")
    .insert({
      farm_id: farmId,
      user_id: session.userId,
      language: "en-IN",
      transcript,
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
  if (entry?.id) qs.set("voiceId", entry.id);

  redirect(`/worker/log/milk?${qs.toString()}`);
}
