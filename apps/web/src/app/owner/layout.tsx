import Link from "next/link";
import { getSession } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase-server";
import { BrandLogo } from "@/components/ui";
import { OwnerNav } from "./OwnerNav";
import { OwnerSidebar } from "./OwnerSidebar";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Unauthenticated routes under /owner (e.g. /owner/login) render bare; the
  // owner pages call requireOwner() and middleware gates the group.
  if (!session || session.profile.role !== "owner") {
    return <div className="min-h-screen bg-surface">{children}</div>;
  }

  const farmId = session.profile.farm_id;
  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const [critRes, milkRes] = await Promise.all([
    supabase.from("agent_findings").select("id").eq("farm_id", farmId).eq("dismissed", false).eq("severity", "critical").limit(1),
    supabase.from("milk_sessions").select("id").eq("farm_id", farmId).eq("session_date", today).limit(1),
  ]);
  const allGood = (critRes.data?.length ?? 0) === 0 && (milkRes.data?.length ?? 0) > 0;

  const Brand = (
    <Link href="/owner/workspace" className="flex items-center gap-2.5">
      <BrandLogo size={38} />
      <span className="leading-tight">
        <strong className="block text-ink">Vayumukhi</strong>
        <small className="text-xs text-ink-3">Owner App</small>
      </span>
    </Link>
  );

  const SignOut = (
    <form action="/api/auth/signout" method="post">
      <button type="submit" className="w-full rounded-pill border border-line px-3 py-2 text-sm text-ink-2 hover:bg-surface">
        Sign out
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {Brand}
          <div className="flex items-center gap-2">
            <Link href="/owner/notifications" aria-label="Notifications" className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-surface">🔔</Link>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-sm text-ink-2 hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
        <div className="px-4 pb-3">
          <OwnerNav />
        </div>
      </header>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-white px-4 py-5 lg:flex">
          {Brand}
          <div className="mt-6 flex-1 overflow-y-auto">
            <OwnerSidebar />
          </div>
          <div className="space-y-3 pt-4">
            <div className={`rounded-tile px-4 py-3 ${allGood ? "bg-ok/10" : "bg-warn/10"}`}>
              <p className="eyebrow">Farm status</p>
              <strong className={`font-serif text-xl ${allGood ? "text-ok" : "text-warn"}`}>
                {allGood ? "All good" : "Needs care"}
              </strong>
            </div>
            <Link href="/owner/notifications" className="flex items-center gap-2 rounded-tile px-2 py-2 text-sm text-ink-2 hover:bg-surface">
              <span aria-hidden>🔔</span> Notifications
            </Link>
            {SignOut}
          </div>
        </aside>

        <main className="w-full flex-1 px-5 py-8 lg:ml-60 lg:px-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
