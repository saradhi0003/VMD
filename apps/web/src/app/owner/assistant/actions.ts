"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { extractMilkFromText, type MilkExtraction } from "@vmd/llm";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const Input = z.object({ text: z.string().min(1).max(1000) });

export async function askAssistant(formData: FormData) {
  const session = await requireOwner();
  const { text } = Input.parse({ text: formData.get("text") });

  let parsed: MilkExtraction | null = null;
  try {
    parsed = await extractMilkFromText(text);
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.litres == null) {
    redirect(`/owner/assistant?err=${encodeURIComponent('I couldn’t read a milk amount. Try: "Lakshmi 7 litres morning, fat 4.2".')}`);
  }

  const supabase = await createSupabaseServer();
  const { data: animals } = await supabase
    .from("animals")
    .select("id,name,tag")
    .eq("farm_id", session.profile.farm_id);
  const low = text.toLowerCase();
  const hit = (animals ?? []).find((a) => low.includes(a.name.toLowerCase()) || low.includes(a.tag.toLowerCase()));
  const shift = parsed.shift ?? (new Date().getHours() < 12 ? "morning" : "evening");

  const { data, error } = await supabase
    .from("milk_sessions")
    .insert({
      farm_id: session.profile.farm_id,
      session_date: new Date().toISOString().slice(0, 10),
      shift,
      animal_id: hit?.id ?? null,
      litres: parsed.litres.toFixed(2),
      fat_pct: parsed.fatPct ?? null,
      milker_id: session.userId,
      source: "assistant",
    })
    .select()
    .single();
  if (error || !data) redirect(`/owner/assistant?err=${encodeURIComponent(error?.message ?? "Could not save the entry.")}`);

  await recordAudit({
    farmId: session.profile.farm_id,
    userId: session.userId,
    action: "create",
    entity: "milk_session",
    entityId: data.id,
    diff: { text, parsed },
  });

  const who = hit?.name ?? "the herd";
  const fat = parsed.fatPct != null ? `, ${parsed.fatPct}% fat` : "";
  redirect(`/owner/assistant?ok=${encodeURIComponent(`Logged ${parsed.litres} L for ${who} (${shift}${fat}).`)}`);
}
