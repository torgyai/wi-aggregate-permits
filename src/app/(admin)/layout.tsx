import { cookies } from "next/headers";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { db } from "@/lib/db";
import { readSession, SESSION_COOKIE } from "@/lib/session";
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
  const counts = await navCounts();
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col md:flex-row">
      <aside className="no-print border-b border-stone-200 bg-white px-3 py-3 md:w-52 md:shrink-0 md:border-b-0 md:border-r md:py-5">
        <Link href="/" className="mb-4 block px-3">
          <div className="text-base font-bold tracking-tight">Stratex Aggregate</div>
          <div className="text-xs text-stone-500">WI pit &amp; quarry permitting</div>
        </Link>
        <Nav counts={counts} />
        <form action={logout} className="mt-6 hidden px-3 md:block">
          <div className="truncate text-xs text-stone-500">{session.email}</div>
          <button className="mt-1 text-xs text-stone-500 underline">Sign out</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
