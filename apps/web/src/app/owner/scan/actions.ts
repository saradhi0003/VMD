"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";
import { confirmFeedFromScan, confirmMilkFromScan, runScanUpload } from "@/lib/scan";

/**
 * Owner half of the Smart Scan flow. The pipeline itself lives in `lib/scan.ts`
 * and is shared with `/worker/scan`; only the guard and the redirects differ.
 * `confirmExpense` is owner-only — workers can't book expenses.
 */

export async function processScan(formData: FormData) {
  const session = await requireOwner();
  const out = await runScanUpload(session, formData);
  if (!out.ok) redirect(`/owner/scan?error=${out.code}`);
  redirect(`/owner/scan/review?scanId=${out.scanId}`);
}

export async function confirmMilkRows(formData: FormData) {
  const session = await requireOwner();
  await confirmMilkFromScan(session, formData);
  redirect("/owner/production");
}

export async function confirmFeedRows(formData: FormData) {
  const session = await requireOwner();
  await confirmFeedFromScan(session, formData);
  redirect("/owner/workspace");
}

const ExpenseInput = z.object({
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(["salaries", "medication", "feed", "misc"]),
  description: z.string().max(2000).optional(),
  amount: z.coerce.number().positive(),
});

export async function confirmExpense(formData: FormData) {
  const session = await requireOwner();
  const parsed = ExpenseInput.parse({
    occurredAt: formData.get("occurredAt") || new Date().toISOString().slice(0, 10),
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
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "scan_confirm", entity: "expense", entityId: data.id, diff: parsed });
  redirect("/owner/expenses");
}
