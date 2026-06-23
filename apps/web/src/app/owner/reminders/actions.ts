"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const Input = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["doctor", "fodder", "feed", "vaccination", "delivery", "other"]),
  priority: z.enum(["low", "medium", "high"]),
  dueAt: z.string().min(1),
});

export async function addReminder(formData: FormData) {
  const session = await requireOwner();
  const parsed = Input.parse({
    title: formData.get("title"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    dueAt: formData.get("dueAt"),
  });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      farm_id: session.profile.farm_id,
      title: parsed.title,
      type: parsed.type,
      priority: parsed.priority,
      due_at: new Date(parsed.dueAt).toISOString(),
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "create", entity: "reminder", entityId: data.id, diff: parsed });
  revalidatePath("/owner/reminders");
  revalidatePath("/worker");
}

export async function markReminderDone(formData: FormData) {
  const session = await requireOwner();
  const reminderId = z.string().uuid().parse(formData.get("reminderId"));

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("reminders")
    .update({ done_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("farm_id", session.profile.farm_id);
  if (error) throw new Error(error.message);

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "complete", entity: "reminder", entityId: reminderId });
  revalidatePath("/owner/reminders");
}
