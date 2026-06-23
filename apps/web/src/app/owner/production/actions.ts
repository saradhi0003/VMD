"use server";

import { emit } from "@vmd/jobs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const Input = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.enum(["morning", "evening"]),
  litres: z.coerce.number().positive(),
  fatPct: z.coerce.number().min(0).max(15).optional(),
});

export async function logMilkSession(formData: FormData) {
  const session = await requireOwner();
  const parsed = Input.parse({
    sessionDate: formData.get("sessionDate"),
    shift: formData.get("shift"),
    litres: formData.get("litres"),
    fatPct: formData.get("fatPct") || undefined,
  });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("milk_sessions")
    .insert({
      farm_id: session.profile.farm_id,
      session_date: parsed.sessionDate,
      shift: parsed.shift,
      litres: parsed.litres.toFixed(2),
      fat_pct: parsed.fatPct ?? null,
      milker_id: session.userId,
      source: "owner-form",
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "insert failed");

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

  revalidatePath("/owner/production");
  revalidatePath("/owner");
}
