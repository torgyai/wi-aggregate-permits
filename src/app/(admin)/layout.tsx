import { cookies } from "next/headers";
import Link from "next/link";
import { Mountain, ShieldCheck, Zap } from "lucide-react";
import { Nav } from "@/components/Nav";
import { db } from "@/lib/db";
import { liveSendEnabled } from "@/lib/outreach/mailer";
import { readSession, SESSION_COOKIE } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { logout } from "../actions";

async function navCounts() {
  const [inbox, tasks] = await Promise.all([
    db.message.count({ where: { status: "PENDING_APPROVAL" } }),
    db.task.count({ where: { status: "OPEN", dueAt: { lte: new Date() } } }),
  ]);
  return { "/inbox": inbox, "/tasks": tasks };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gates these routes; this just reads who is signed in.
  const session = (await readSession(cookies().get(SESSION_COOKIE)?.value)) ?? { email: "" };
  const [counts, s] = await Promise.all([navCounts(), getSettings()]);
  const live = liveSendEnabled();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print sticky top-0 z-20 flex flex-col bg-slate-950 px-3 py-3 md:h-screen md:w-60 md:shrink-0 md:py-5">
        <Link href="/" className="mb-6 hidden items-center gap-2.5 px-3 md:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
            <Mountain className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Stratex Aggregate</div>
            <div className="text-[11px] text-slate-500">WI permitting autopilot</div>
          </div>
        </Link>
        <Nav counts={counts} />
        <form action={logout} className="mt-auto hidden border-t border-white/5 px-3 pt-4 md:block">
          <div className="truncate text-xs text-slate-400">{session.email}</div>
          <button className="mt-1 text-xs text-slate-500 hover:text-slate-300">Sign out</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="no-print sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-slate-200/70 bg-slate-50/80 px-4 py-2.5 backdrop-blur md:px-10">
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset " +
              (live ? "bg-rose-50 text-rose-700 ring-rose-600/20" : "bg-emerald-50 text-emerald-700 ring-emerald-600/20")
            }
            title={live ? "Real email is being sent" : "Dry run: emails are recorded, nothing is sent"}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {live ? "Live sending" : "Safe mode — no emails leave"}
          </span>
          <Link
            href="/settings"
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset " +
              (s.autopilot ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/10")
            }
          >
            <Zap className="h-3.5 w-3.5" />
            Autopilot {s.autopilot ? "on" : "off"}
          </Link>
        </div>
        <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
