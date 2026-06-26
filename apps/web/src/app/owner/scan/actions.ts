"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";
import { bulkInsertFeed, bulkInsertMilk, uploadAndScan } from "@/lib/scan";

export async function processScan(formData: FormData) {
  const session = await requireOwner();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/owner/scan?error=no_image");
  }
  const { scanId } = await uploadAndScan(file, session.profile.farm_id, session.userId);
  if (!scanId) redirect("/owner/scan?error=scan_failed");
  redirect(`/owner/scan/review?scanId=${scanId}`);
}

const MilkRows = z.array(
  z.object({
    animal: z.string().nullable(),
    litres: z.number().nullable(),
    fatPct: z.number().nullable(),
    shift: z.enum(["morning", "evening"]).nullable(),
  }),
);
export async function confirmMilkRows(formData: FormData) {
  const session = await requireOwner();
  const scanId = z.string().uuid().parse(formData.get("scanId"));
  const rows = MilkRows.parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  const n = await bulkInsertMilk(session.profile.farm_id, session.userId, rows);
  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "scan_confirm", entity: "milk_session", entityId: scanId, diff: { count: n } });
  redirect("/owner/production");
}

const FeedRows = z.array(
  z.object({ feedType: z.string().nullable(), quantity: z.string().nullable(), animal: z.string().nullable() }),
);
export async function confirmFeedRows(formData: FormData) {
  const session = await requireOwner();
  const scanId = z.string().uuid().parse(formData.get("scanId"));
  const rows = FeedRows.parse(JSON.parse(String(formData.get("rows") ?? "[]")));
  const n = await bulkInsertFeed(session.profile.farm_id, session.userId, rows);
  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "scan_confirm", entity: "activity_log:feed", entityId: scanId, diff: { count: n } });
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
