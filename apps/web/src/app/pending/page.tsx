import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { requestAccessNotice, signOutAction } from "./actions";

/**
 * Waiting room for accounts the farm owner hasn't approved yet.
 *
 * This screen is UX, not security — the account already reads zero rows because
 * every RLS policy carries `is_approved()` (migration 0005). Its job is to tell
 * the person *why* they see nothing, and to ping the owner.
 */
export default async function PendingPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/owner/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status,name,email,notified_at")
    .eq("id", user.id)
    .maybeSingle();

  // Approved (or pre-migration DB) → nothing to wait for.
  if (!profile || profile.status === "active") redirect("/");

  const disabled = profile.status === "disabled";

  return (
    <div className="mx-auto mt-24 max-w-md px-6">
      <div className="rounded-card border border-line bg-white p-8">
        <p className="eyebrow">{disabled ? "Account disabled" : "Access requested"}</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">
          {disabled ? "This account is switched off" : "Waiting for approval"}
        </h1>

        <p className="mt-3 text-sm text-ink-2">
          {disabled ? (
            <>
              Your account has been disabled by the farm owner. Contact them if you think
              this is a mistake.
            </>
          ) : (
            <>
              You&apos;re signed in as <span className="text-ink">{profile.email ?? user.email}</span>, but
              the farm owner hasn&apos;t granted access yet. You&apos;ll see the farm&apos;s data as soon
              as they approve you.
            </>
          )}
        </p>

        {!disabled && (
          <form action={requestAccessNotice} className="mt-6">
            <button
              type="submit"
              className="min-h-[52px] w-full rounded-pill bg-navy font-semibold text-white hover:bg-navy-deep"
            >
              {profile.notified_at ? "Send another reminder" : "Notify the owner"}
            </button>
            {profile.notified_at && (
              <p className="mt-2 text-center text-xs text-ink-2">
                Owner last notified {new Date(profile.notified_at).toLocaleString()}
              </p>
            )}
          </form>
        )}

        <form action={signOutAction} className="mt-3">
          <button type="submit" className="w-full text-center text-sm text-ink-2 hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
