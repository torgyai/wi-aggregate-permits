import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { ALL_LESSONS, TRAINING_KEY } from "@/lib/training";
import { toggleLesson } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: { slug: string } }) {
  const i = ALL_LESSONS.findIndex((l) => l.slug === params.slug);
  if (i < 0) notFound();
  const lesson = ALL_LESSONS[i];
  const prev = ALL_LESSONS[i - 1];
  const next = ALL_LESSONS[i + 1];
  const row = await db.setting.findUnique({ where: { key: TRAINING_KEY } });
  const done = new Set<string>(row ? JSON.parse(row.value) : []);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/training" className="btn-ghost -ml-2 mb-4"><ArrowLeft className="h-4 w-4" /> All lessons</Link>
      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Lesson {i + 1} of {ALL_LESSONS.length} · {lesson.minutes} min</div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
      <p className="mt-2 text-slate-500">{lesson.summary}</p>
      <article className="card mt-6 p-8">
        <Markdown source={lesson.body} />
      </article>
      <div className="card mt-6 border-indigo-100 bg-indigo-50/50 p-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-900"><Lightbulb className="h-4 w-4" /> Key takeaways</div>
        <ul className="space-y-1.5 text-sm text-indigo-950">
          {lesson.takeaways.map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />{t}</li>)}
        </ul>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {prev ? <Link href={`/training/${prev.slug}`} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> {prev.title}</Link> : <span />}
        <form action={toggleLesson.bind(null, lesson.slug)}>
          <SubmitButton className={done.has(lesson.slug) ? "btn-secondary" : "btn"}>{done.has(lesson.slug) ? "Completed ✓ (undo)" : "Mark complete"}</SubmitButton>
        </form>
        {next ? <Link href={`/training/${next.slug}`} className="btn-secondary">{next.title} <ArrowRight className="h-4 w-4" /></Link> : <Link href="/launch" className="btn-secondary">Launch checklist <ArrowRight className="h-4 w-4" /></Link>}
      </div>
    </div>
  );
}
