"use server";

import { emit } from "@vmd/jobs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function triggerDailyAgent() {
  const session = await requireOwner();
  await emit({
    name: "farm/daily-agent.requested",
    data: { farmId: session.profile.farm_id, forDate: new Date().toISOString().slice(0, 10) },
  });
  revalidatePath("/owner/agent");
}

const DismissInput = z.object({ findingId: z.string().uuid() });

/** Owner dismisses an AI finding (RLS: owner + own farm). */
export async function dismissFinding(formData: FormData) {
  const session = await requireOwner();
  const { findingId } = DismissInput.parse({ findingId: formData.get("findingId") });

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("agent_findings")
    .update({ dismissed: true })
    .eq("id", findingId)
    .eq("farm_id", session.profile.farm_id);
  if (error) throw new Error(error.message);

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "dismiss",
    entity: "agent_finding",
    entityId: findingId,
  });

  revalidatePath("/owner/agent");
  revalidatePath("/owner");
}
