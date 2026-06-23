"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };
const GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Workspace",
    items: [
      { href: "/owner/workspace", label: "Owner Workspace", icon: "W" },
      { href: "/owner", label: "Today", icon: "H" },
    ],
  },
  {
    heading: "Farm",
    items: [
      { href: "/owner/production", label: "Milk", icon: "M" },
      { href: "/owner/herd", label: "Animals", icon: "A" },
      { href: "/owner/sales", label: "Sales", icon: "S" },
      { href: "/owner/expenses", label: "Costs", icon: "C" },
      { href: "/owner/reminders", label: "Reminders", icon: "R" },
    ],
  },
  {
    heading: "AI",
    items: [
      { href: "/owner/agent", label: "Alerts", icon: "!" },
      { href: "/owner/assistant", label: "Assistant", icon: "AI" },
    ],
  },
  {
    heading: "Settings",
    items: [{ href: "/owner/team", label: "Team & access", icon: "T" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/owner") return pathname === "/owner";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OwnerSidebar() {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.heading}>
          <p className="eyebrow mb-1.5 px-2">{g.heading}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`flex items-center gap-3 rounded-tile px-2 py-2 text-sm font-medium transition ${
                    active ? "bg-surface-alt text-navy" : "text-ink-2 hover:bg-surface"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-[11px] font-bold ${
                      active ? "bg-navy text-white" : "bg-surface text-ink-3"
                    }`}
                  >
                    {it.icon}
                  </span>
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
