import { redirect } from "next/navigation";
import { createServiceClient } from "@vmd/supabase";
import { getSession } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { BrandLogo } from "@/components/ui";

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/owner/login?error=invite_expired");
  const sp = await searchParams;

  return (
    <div className="mx-auto mt-20 max-w-md px-6">
      <div className="rounded-card border border-line bg-white p-8">
        <BrandLogo size={56} />
        <h1 className="mt-5 font-serif text-3xl text-ink">Welcome, {session.profile.name}</h1>
        <p className="mt-2 text-sm text-ink-2">Set a password to finish creating your account. Next, you&apos;ll set up two-factor security.</p>

        {sp.error && (
          <p className="mt-4 rounded-tile bg-warn/10 p-3 text-sm text-warn">
            {sp.error === "weak" ? "Use at least 8 characters." : sp.error === "mismatch" ? "Passwords don't match." : "Couldn't save — try again."}
          </p>
        )}

        <form
          action={async (formData) => {
            "use server";
            const s = await getSession();
            if (!s) redirect("/owner/login?error=invite_expired");
            const password = String(formData.get("password") ?? "");
            const confirm = String(formData.get("confirm") ?? "");
            if (password.length < 8) redirect("/onboard?error=weak");
            if (password !== confirm) redirect("/onboard?error=mismatch");

            const supabase = await createSupabaseServer();
            const { error } = await supabase.auth.updateUser({ password });
            if (error) redirect(`/onboard?error=${encodeURIComponent(error.message)}`);

            // mark the account active (service client — invited user can't update own profile under RLS)
            await createServiceClient().from("profiles").update({ status: "active" }).eq("id", s.userId);
            redirect("/mfa/enroll?next=/owner");
          }}
          className="mt-6 space-y-3"
        >
          <input
            type="password"
            name="password"
            required
            autoComplete="new-password"
            placeholder="New password (min 8 characters)"
            className="w-full rounded-tile border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
          />
          <input
            type="password"
            name="confirm"
            required
            autoComplete="new-password"
            placeholder="Confirm password"
            className="w-full rounded-tile border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
          />
          <button className="min-h-[52px] w-full rounded-pill bg-navy font-semibold text-white hover:bg-navy-deep">
            Set password &amp; continue
          </button>
        </form>
      </div>
    </div>
  );
}
