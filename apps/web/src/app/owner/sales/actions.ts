"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createSupabaseServer } from "@/lib/supabase-server";

const SaleInput = z.object({
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  qty: z.coerce.number().positive(),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addSale(formData: FormData) {
  const session = await requireOwner();
  const parsed = SaleInput.parse({
    customerId: formData.get("customerId"),
    productId: formData.get("productId"),
    qty: formData.get("qty"),
    occurredAt: formData.get("occurredAt"),
  });

  const supabase = await createSupabaseServer();
  const { data: product } = await supabase
    .from("products")
    .select("price_minor")
    .eq("farm_id", session.profile.farm_id)
    .eq("id", parsed.productId)
    .single();
  if (!product) throw new Error("Product not found in your farm.");

  const amount_minor = Math.round(parsed.qty * product.price_minor);
  const { data, error } = await supabase
    .from("sales")
    .insert({
      farm_id: session.profile.farm_id,
      customer_id: parsed.customerId,
      product_id: parsed.productId,
      occurred_at: `${parsed.occurredAt}T12:00:00.000Z`,
      qty: parsed.qty.toFixed(2),
      amount_minor,
      created_by: session.userId,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "create", entity: "sale", entityId: data.id, diff: parsed });
  revalidatePath("/owner/sales");
  revalidatePath("/owner");
}

const CustomerInput = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(24).optional(),
  route: z.string().max(64).optional(),
});

export async function addCustomer(formData: FormData) {
  const session = await requireOwner();
  const parsed = CustomerInput.parse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    route: formData.get("route") || undefined,
  });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("customers")
    .insert({ farm_id: session.profile.farm_id, name: parsed.name, phone: parsed.phone ?? null, route: parsed.route ?? null, is_active: true })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");

  await recordAudit({ farmId: session.profile.farm_id, userId: session.userId, action: "create", entity: "customer", entityId: data.id, diff: parsed });
  revalidatePath("/owner/sales");
}
