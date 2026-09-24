import Link from "next/link";
import { CheckCircle2, Circle, Clock, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { ALL_LESSONS, COURSE, TRAINING_KEY } from "@/lib/training";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const row = await db.setting.findUnique({ where: { key: TRAINING_KEY } });
  const done = new Set<string>(row ? JSON.parse(row.value) : []);
  const total = ALL_LESSONS.length;
  const pct = Math.round((ALL_LESSONS.filter((l) => done.has(l.slug)).length / total) * 100);
  const minutes = ALL_LESSONS.reduce((a, l) => a + l.minutes, 0);
  const next = ALL_LESSONS.find((l) => !done.has(l.slug));

  return (
    <>
      <PageHeader eyebrow="Training" title="How this business and this software work" subtitle={`${total} lessons · about ${minutes} minutes · from the offer to filing permits`} />
      <div className="card mb-8 overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><GraduationCap className="h-7 w-7 text-indigo-200" /></div>
          <div className="flex-1">
            <div className="text-sm text-indigo-200">Your progress</div>
            <div className="text-2xl font-semibold">{pct}% complete</div>
            <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {next && <Link href={`/training/${next.slug}`} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-indigo-50">{done.size ? "Continue" : "Start"}: {next.title} →</Link>}
        </div>
      </div>
      <div className="space-y-8">
        {COURSE.map((m) => (
          <section key={m.title}>
            <h2 className="mb-3 text-sm font-semibold text-slate-500">{m.title}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {m.lessons.map((l) => (
                <Link key={l.slug} href={`/training/${l.slug}`} className="card group flex gap-4 p-5 transition hover:border-indigo-300">
                  {done.has(l.slug) ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />}
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 group-hover:text-indigo-600">{l.title}</div>
                    <p className="mt-1 text-sm text-slate-500">{l.summary}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" /> {l.minutes} min</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
