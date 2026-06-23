"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const Input = z.object({
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(["salaries", "medication", "feed", "misc"]),
  description: z.string().max(2000).optional(),
  amount: z.coerce.number().positive(),
});

export async function addExpense(formData: FormData) {
  const session = await requireOwner();
  const parsed = Input.parse({
    occurredAt: formData.get("occurredAt"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    amount: formData.get("amount"),
  });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      farm_id: session.profile.farm_id,
      occurred_at: `${parsed.occurredAt}T12:00:00.000Z`,
      category: parsed.category,
      description: parsed.description ?? null,
      amount_minor: Math.round(parsed.amount * 100),
      created_by: session.userId,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "create", entity: "expense", entityId: data.id, diff: parsed });
  revalidatePath("/owner/expenses");
  revalidatePath("/owner");
}
