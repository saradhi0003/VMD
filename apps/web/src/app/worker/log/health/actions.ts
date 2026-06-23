"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorker } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";
import { assertAnimalInFarm } from "@/lib/validate";

const Input = z.object({
  animalId: z.string().uuid(),
  kind: z.string().min(1).max(64),
  details: z.string().max(2000).optional(),
  vetName: z.string().max(120).optional(),
  medication: z.string().max(120).optional(),
  withdrawalUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function logHealthEvent(formData: FormData) {
  const session = await requireWorker();
  const parsed = Input.parse({
    animalId: formData.get("animalId"),
    kind: formData.get("kind"),
    details: formData.get("details") || undefined,
    vetName: formData.get("vetName") || undefined,
    medication: formData.get("medication") || undefined,
    withdrawalUntil: formData.get("withdrawalUntil") || undefined,
  });

  await assertAnimalInFarm(session.profile.farm_id, parsed.animalId);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("animal_health_events")
    .insert({
      farm_id: session.profile.farm_id,
      animal_id: parsed.animalId,
      occurred_at: new Date().toISOString(),
      kind: parsed.kind,
      details: parsed.details ?? null,
      vet_name: parsed.vetName ?? null,
      medication: parsed.medication ?? null,
      withdrawal_until: parsed.withdrawalUntil ?? null,
      created_by: session.userId,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "create",
    entity: "animal_health_event",
    entityId: data.id,
    diff: parsed,
  });

  revalidatePath("/worker");
  redirect("/worker?logged=health");
}
