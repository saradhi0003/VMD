import Link from "next/link";
import { BrandLogo } from "@/components/ui";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface pb-20">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link href="/worker" className="flex items-center gap-2">
            <BrandLogo size={32} />
            <strong className="text-sm text-ink">Worker</strong>
          </Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-sm text-ink-2 hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
