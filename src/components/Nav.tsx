"use client";
import clsx from "clsx";
import {

  Building2,

  Database,
  FolderKanban,
  GraduationCap,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Rocket,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "Sell",
    links: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/sites", label: "Leads", icon: MapPin },
      { href: "/accounts", label: "Target accounts", icon: Building2 },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    label: "Deliver",
    links: [{ href: "/projects", label: "Projects", icon: FolderKanban }],
  },
  {
    label: "Run",
    links: [
      { href: "/launch", label: "Launch checklist", icon: Rocket },
      { href: "/training", label: "Training", icon: GraduationCap },
      { href: "/import", label: "Data", icon: Database },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Nav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-5">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-row gap-1 md:flex-col">
          <div className="hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 md:block">{g.label}</div>
          {g.links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            const n = counts[l.href];
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "group flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                )}
              >
                <Icon className={clsx("h-4 w-4", active ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300")} />
                <span className="flex-1">{l.label}</span>
                {n ? <span className="rounded-full bg-indigo-500 px-1.5 text-[10px] font-semibold text-white">{n}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

