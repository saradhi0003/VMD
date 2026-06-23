"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorker } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";
import { assertAnimalInFarm } from "@/lib/validate";

const Input = z.object({
  animalId: z.string().uuid().optional(),
  feedType: z.string().min(1).max(64),
  quantity: z.string().max(64).optional(),
  note: z.string().max(2000).optional(),
});

export async function logFeed(formData: FormData) {
  const session = await requireWorker();
  const parsed = Input.parse({
    animalId: formData.get("animalId") || undefined,
    feedType: formData.get("feedType"),
    quantity: formData.get("quantity") || undefined,
    note: formData.get("note") || undefined,
  });

  if (parsed.animalId) await assertAnimalInFarm(session.profile.farm_id, parsed.animalId);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("activity_logs")
    .insert({
      farm_id: session.profile.farm_id,
      user_id: session.userId,
      kind: "feed",
      animal_id: parsed.animalId ?? null,
      note: parsed.note ?? null,
      payload: { feedType: parsed.feedType, quantity: parsed.quantity ?? null },
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "create",
    entity: "activity_log:feed",
    entityId: data.id,
    diff: parsed,
  });

  revalidatePath("/worker");
  redirect("/worker?logged=feed");
}
