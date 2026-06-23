"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorker } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const Input = z.object({
  area: z.string().min(1).max(64),
  note: z.string().max(2000).optional(),
});

export async function logWash(formData: FormData) {
  const session = await requireWorker();
  const parsed = Input.parse({
    area: formData.get("area"),
    note: formData.get("note") || undefined,
  });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("activity_logs")
    .insert({
      farm_id: session.profile.farm_id,
      user_id: session.userId,
      kind: "wash",
      note: parsed.note ?? null,
      payload: { area: parsed.area },
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "create",
    entity: "activity_log:wash",
    entityId: data.id,
    diff: parsed,
  });

  revalidatePath("/worker");
  redirect("/worker?logged=wash");
}
