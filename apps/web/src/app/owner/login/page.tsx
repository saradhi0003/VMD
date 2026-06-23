import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { BrandLogo } from "@/components/ui";

export default function OwnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  return (
    <div className="mx-auto mt-24 max-w-md px-6">
      <div className="rounded-card border border-line bg-white p-8">
        <BrandLogo size={56} />
        <h1 className="mt-5 font-serif text-3xl text-ink">Welcome back</h1>
        <p className="mt-2 text-sm text-ink-2">Sign in to the owner workspace.</p>

        <Banner searchParams={searchParams} />

        {/* Primary: email + password */}
        <form
          action={async (formData) => {
            "use server";
            const email = String(formData.get("email") ?? "").trim();
            const password = String(formData.get("password") ?? "");
            if (!email.includes("@") || !password) redirect("/owner/login?error=invalid_input");
            const supabase = await createSupabaseServer();
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) redirect(`/owner/login?error=${encodeURIComponent(error.message)}`);
            redirect("/owner");
          }}
          className="mt-6 space-y-3"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="you@vayumukhi.in"
            autoComplete="email"
            className="w-full rounded-tile border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-blue focus:ring-2 focus:ring-blue/20"
          />
          <input
            type="password"
            name="password"
            required
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-tile border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-blue focus:ring-2 focus:ring-blue/20"
          />
          <button className="w-full rounded-pill bg-navy px-4 py-3 font-semibold text-white hover:bg-navy-deep">
            Sign in
          </button>
        </form>

        <p className="mt-3 rounded-tile bg-surface px-3 py-2 font-mono text-xs text-ink-2">
          Demo owner — <span className="text-ink">admin@vayumukhi.in</span> / <span className="text-ink">farm123</span>
        </p>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3 text-ink-3">
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em]">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Secondary: magic link */}
        <form
          action={async (formData) => {
            "use server";
            const email = formData.get("email");
            if (typeof email !== "string" || !email.includes("@")) redirect("/owner/login?error=enter_email_above");
            const supabase = await createSupabaseServer();
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: {
                emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/callback?next=/owner`,
              },
            });
            if (error) redirect(`/owner/login?error=${encodeURIComponent(error.message)}`);
            redirect("/owner/login?sent=1");
          }}
        >
          <input
            type="email"
            name="email"
            required
            placeholder="Email for a one-tap link"
            autoComplete="email"
            className="w-full rounded-tile border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-blue focus:ring-2 focus:ring-blue/20"
          />
          <button className="mt-2 w-full rounded-pill border-[1.5px] border-line bg-white px-4 py-3 font-semibold text-ink hover:bg-surface">
            Email me a sign-in link
          </button>
        </form>

        {/* Google — only works once enabled in Supabase Auth → Providers */}
        <form
          action={async () => {
            "use server";
            const supabase = await createSupabaseServer();
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/auth/callback?next=/owner`,
              },
            });
            if (error || !data.url) redirect(`/owner/login?error=${encodeURIComponent(error?.message ?? "google_not_enabled")}`);
            redirect(data.url);
          }}
          className="mt-3"
        >
          <button className="w-full rounded-pill px-4 py-3 text-sm font-semibold text-ink-2 hover:bg-surface">
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}

async function Banner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const sp = await searchParams;
  if (sp.sent) {
    return <p className="mt-4 rounded-tile bg-ok/10 p-3 text-sm text-ok">Check your email for the sign-in link.</p>;
  }
  if (sp.error) {
    return <p className="mt-4 rounded-tile bg-warn/10 p-3 text-sm text-warn">Sign-in failed: {sp.error}</p>;
  }
  return null;
}
