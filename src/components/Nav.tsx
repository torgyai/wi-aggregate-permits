"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/sites", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/inbox", label: "Inbox" },
  { href: "/tasks", label: "Tasks" },
  { href: "/projects", label: "Projects" },
  { href: "/import", label: "Data" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        const n = counts[l.href];
        return (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "flex items-center justify-between whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
              active ? "bg-amber-100 font-semibold text-amber-900" : "text-stone-600 hover:bg-stone-100",
            )}
          >
            {l.label}
            {n ? <span className="ml-2 rounded-full bg-amber-600 px-1.5 text-xs font-semibold text-white">{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
