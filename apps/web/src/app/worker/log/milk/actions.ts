"use server";

import { emit } from "@vmd/jobs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorker } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";
import { assertAnimalInFarm } from "@/lib/validate";

const Input = z.object({
  animalId: z.string().uuid(),
  shift: z.enum(["morning", "evening"]),
  litres: z.coerce.number().positive(),
  fatPct: z.coerce.number().min(0).max(15).optional(),
  scanId: z.string().uuid().optional(),
  voiceId: z.string().uuid().optional(),
});

export async function logMilkFromWorker(formData: FormData) {
  const session = await requireWorker();
  const parsed = Input.parse({
    animalId: formData.get("animalId"),
    shift: formData.get("shift"),
    litres: formData.get("litres"),
    fatPct: formData.get("fatPct") || undefined,
    scanId: formData.get("scanId") || undefined,
    voiceId: formData.get("voiceId") || undefined,
  });

  await assertAnimalInFarm(session.profile.farm_id, parsed.animalId);

  const supabase = await createSupabaseServer();
  const source = parsed.scanId ? "scan" : parsed.voiceId ? "voice" : "worker-app";
  const { data, error } = await supabase
    .from("milk_sessions")
    .insert({
      farm_id: session.profile.farm_id,
      session_date: new Date().toISOString().slice(0, 10),
      shift: parsed.shift,
      animal_id: parsed.animalId,
      litres: parsed.litres.toFixed(2),
      fat_pct: parsed.fatPct ?? null,
      milker_id: session.userId,
      source,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "insert failed");

  // Close the loop on a Smart Scan / Voice capture.
  if (parsed.scanId) {
    await supabase.from("scan_events").update({ applied_session_id: data.id }).eq("id", parsed.scanId);
  }
  if (parsed.voiceId) {
    await supabase.from("voice_entries").update({ applied_session_id: data.id }).eq("id", parsed.voiceId);
  }

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "create",
    entity: "milk_session",
    entityId: data.id,
    diff: parsed,
  });

  await emit({
    name: "milk-session/created",
    data: { farmId: session.profile.farm_id, sessionId: data.id },
  });

  revalidatePath("/worker");
  redirect("/worker");
}
