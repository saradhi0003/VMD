import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { workerEmail } from "@/lib/auth";
import { BrandLogo } from "@/components/ui";

export default function WorkerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="mx-auto mt-24 max-w-md px-6">
      <div className="rounded-card border border-line bg-white p-8">
        <BrandLogo size={56} />
        <h1 className="mt-5 font-serif text-3xl text-ink">Who&apos;s working today?</h1>
        <p className="mt-2 text-base text-ink-2">Enter your name and the PIN your supervisor gave you.</p>

        <Error searchParams={searchParams} />

        <form
          action={async (formData) => {
            "use server";
            const name = String(formData.get("name") ?? "").trim();
            const pin = String(formData.get("pin") ?? "");
            if (!name || !/^\d{4,8}$/.test(pin)) {
              redirect("/worker/login?error=invalid_input");
            }
            const supabase = await createSupabaseServer();
            const { error } = await supabase.auth.signInWithPassword({
              email: workerEmail(name),
              password: pin,
            });
            if (error) redirect(`/worker/login?error=${encodeURIComponent(error.message)}`);
            redirect("/worker");
          }}
          className="mt-6 space-y-3"
        >
          <input
            name="name"
            required
            placeholder="Your name (e.g., Suresh)"
            className="w-full rounded-tile border border-line bg-white px-4 py-3.5 text-lg text-ink outline-none transition placeholder:text-ink-3 focus:border-blue focus:ring-2 focus:ring-blue/20"
          />
          <input
            name="pin"
            required
            inputMode="numeric"
            pattern="\d{4,8}"
            maxLength={8}
            placeholder="PIN"
            className="w-full rounded-tile border border-line bg-white px-4 py-3.5 text-lg tracking-[0.4em] text-ink outline-none transition placeholder:tracking-normal placeholder:text-ink-3 focus:border-blue focus:ring-2 focus:ring-blue/20"
          />
          <button className="min-h-[64px] w-full rounded-pill bg-navy px-4 text-lg font-semibold text-white hover:bg-navy-deep">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

async function Error({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  if (!sp.error) return null;
  return <p className="mt-4 rounded-tile bg-warn/10 p-3 text-sm text-warn">Sign-in failed: {sp.error}</p>;
}
