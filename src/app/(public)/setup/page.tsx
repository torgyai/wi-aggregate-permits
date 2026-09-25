import { CheckCircle2, CircleAlert, Mountain } from "lucide-react";
import { databaseUrl, configProblems } from "@/lib/env";

export const dynamic = "force-dynamic";

async function dbStatus(): Promise<{ ok: boolean; detail: string }> {
  if (!databaseUrl()) return { ok: false, detail: "No database connected." };
  try {
    const { db } = await import("@/lib/db");
    await db.setting.count();
    return { ok: true, detail: "Connected, tables present." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/does not exist/i.test(msg)) return { ok: false, detail: "Connected, but tables are missing — redeploy so the build creates them." };
    return { ok: false, detail: `Can't connect: ${msg.split("\n").slice(-1)[0].slice(0, 200)}` };
  }
}

/** Public self-check: shows which settings are missing (never their values). */
export default async function SetupPage() {
  const problems = configProblems();
  const database = await dbStatus();
  const ok = problems.length === 0 && database.ok;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600"><Mountain className="h-4 w-4 text-white" /></div>
        <span className="font-semibold">Stratex Aggregate — setup check</span>
      </div>
      <div className="card space-y-4 p-6">
        {ok ? (
          <p className="flex items-center gap-2 font-medium text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Everything is configured. <a className="link" href="/login">Sign in →</a></p>
        ) : (
          <p className="flex items-center gap-2 font-medium text-amber-700"><CircleAlert className="h-5 w-5" /> A few settings are missing on the server.</p>
        )}
        <div>
          <div className="text-sm font-semibold">Database</div>
          <p className={`text-sm ${database.ok ? "text-emerald-700" : "text-rose-700"}`}>{database.detail}</p>
        </div>
        {problems.length > 0 && (
          <div>
            <div className="text-sm font-semibold">Environment variables to add</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
          Add them in Vercel → your project → Settings → Environment Variables (Production), then Deployments → ⋯ → Redeploy. Variable changes only apply after a redeploy.
        </p>
      </div>
    </div>
  );
}
