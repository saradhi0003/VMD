"use server";

import { createServiceClient } from "@vmd/supabase";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";

export async function markNotificationRead(formData: FormData) {
  const session = await requireOwner();
  const id = z.string().uuid().parse(formData.get("id"));
  // notifications are user-scoped with no RLS read/update policy → use service client,
  // constrained to this user's own rows.
  const svc = createServiceClient();
  await svc.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", session.userId);
  revalidatePath("/owner/notifications");
}

export async function markAllNotificationsRead() {
  const session = await requireOwner();
  const svc = createServiceClient();
  await svc.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  revalidatePath("/owner/notifications");
}
