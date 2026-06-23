"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorker } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const Done = z.object({ reminderId: z.string().uuid() });

/** Worker marks a reminder complete (RLS: any farm member). */
export async function completeReminder(formData: FormData) {
  const session = await requireWorker();
  const { reminderId } = Done.parse({ reminderId: formData.get("reminderId") });

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("reminders")
    .update({ done_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("farm_id", session.profile.farm_id);
  if (error) throw new Error(error.message);

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "complete",
    entity: "reminder",
    entityId: reminderId,
  });

  revalidatePath("/worker");
}
