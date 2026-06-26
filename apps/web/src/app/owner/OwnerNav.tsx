"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/owner/workspace", label: "Workspace" },
  { href: "/owner", label: "Today" },
  { href: "/owner/production", label: "Milk" },
  { href: "/owner/scan", label: "Scan" },
  { href: "/owner/herd", label: "Animals" },
  { href: "/owner/sales", label: "Sales" },
  { href: "/owner/expenses", label: "Costs" },
  { href: "/owner/reminders", label: "Reminders" },
  { href: "/owner/agent", label: "Alerts" },
  { href: "/owner/assistant", label: "Assistant" },
  { href: "/owner/team", label: "Team" },
];

export function OwnerNav() {
  const pathname = usePathname();
  return (
    <nav className="flex max-w-full gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => {
        const active = it.href === "/owner" ? pathname === "/owner" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`whitespace-nowrap rounded-pill px-3 py-1.5 font-medium transition ${
              active ? "bg-surface-alt text-navy" : "text-ink-2 hover:bg-surface"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
