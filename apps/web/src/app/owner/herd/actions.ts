"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const Input = z.object({
  name: z.string().min(1).max(64),
  tag: z.string().min(1).max(32),
  type: z.enum(["cow", "buffalo", "calf"]),
  status: z.enum(["milking", "dry", "pregnant", "calf", "sold", "deceased"]),
  health: z.enum(["healthy", "observation", "treatment", "quarantine", "recovered"]),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
});

export async function addAnimal(formData: FormData) {
  const session = await requireOwner();
  const parsed = Input.parse({
    name: formData.get("name"),
    tag: formData.get("tag"),
    type: formData.get("type"),
    status: formData.get("status"),
    health: formData.get("health"),
    dob: formData.get("dob") || undefined,
    notes: formData.get("notes") || undefined,
  });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("animals")
    .insert({
      farm_id: session.profile.farm_id,
      name: parsed.name,
      tag: parsed.tag,
      type: parsed.type,
      status: parsed.status,
      health: parsed.health,
      dob: parsed.dob ?? null,
      notes: parsed.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not add animal (is the tag unique?)");

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "create",
    entity: "animal",
    entityId: data.id,
    diff: parsed,
  });

  revalidatePath("/owner/herd");
}
