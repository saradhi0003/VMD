"use server";

import { createServiceClient } from "@vmd/supabase";
import { emit } from "@vmd/jobs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/guard";

/**
 * Ask the farm owner to approve this account.
 *
 * Best-effort by design (FinTracker's rule): the notification is a convenience,
 * never a dependency. If email is unconfigured the request still appears in the
 * owner's Team panel, which is the source of truth. `notified_at` is stamped by
 * the Inngest job only *on a successful send*, so a failed send can retry.
 */
export async function requestAccessNotice() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/owner/login");

  // Blunt an impatient user hammering the button.
  try {
    rateLimit(`signup-notice:${user.id}`, 3, 10 * 60_000);
  } catch {
    redirect("/pending?sent=throttled");
  }

  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id,farm_id,name,email,status")
    .eq("id", user.id)
    .maybeSingle();

  // Only pending accounts may ping — don't let an approved user spam the owner.
  if (profile?.status === "pending") {
    await emit({
      name: "user/access.requested",
      data: {
        farmId: profile.farm_id,
        userId: profile.id,
        name: profile.name ?? "",
        email: profile.email ?? user.email ?? "",
      },
    });
  }

  revalidatePath("/pending");
  redirect("/pending?sent=1");
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/owner/login");
}
