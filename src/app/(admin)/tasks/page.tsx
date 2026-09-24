import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { completeTask, skipTask } from "../../actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  REVIEW_REPLY: "Approve reply",
  MEETING: "Meeting",
  CALL: "Call",
  LINKEDIN: "LinkedIn",
  FOLLOW_UP: "Follow up",
  PERMIT: "Permit work",
  LETTER: "Letter",
  OTHER: "Other",
};

export default async function TasksPage() {
  const tasks = await db.task.findMany({
    where: { status: "OPEN" },
    orderBy: { dueAt: "asc" },
    include: { contact: { include: { company: true } }, deal: { include: { company: true } } },
    take: 300,
  });
  const now = Date.now();
  const due = tasks.filter((t) => t.dueAt.getTime() <= now);
  const later = tasks.filter((t) => t.dueAt.getTime() > now);

  const list = (items: typeof tasks) => (
    <ul className="divide-y divide-slate-100">
      {items.map((t) => (
        <li key={t.id} className="flex flex-wrap items-start gap-3 py-3">
          <Badge tone={t.type === "MEETING" ? "green" : t.type === "PERMIT" ? "violet" : "gray"}>{TYPE_LABEL[t.type] ?? t.type}</Badge>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t.title}</div>
            {t.detail && <div className="text-xs text-slate-600">{t.detail}</div>}
            <div className="mt-0.5 text-xs text-slate-400">
              Due {fmtDate(t.dueAt)}
              {t.contact?.phone && <> · {t.contact.phone}</>}
              {t.contact?.email && <> · {t.contact.email}</>}
              {t.dealId && <> · <Link className="link" href={`/deals/${t.dealId}`}>deal</Link></>}
              {t.projectId && <> · <Link className="link" href={`/projects/${t.projectId}`}>project</Link></>}
              {t.type === "REVIEW_REPLY" && <> · <Link className="link" href="/inbox">inbox</Link></>}
            </div>
          </div>
          <form className="flex gap-2">
            <button formAction={completeTask.bind(null, t.id)} className="btn-secondary">Done</button>
            <button formAction={skipTask.bind(null, t.id)} className="text-xs text-slate-500 underline">Skip</button>
          </form>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader title="Tasks" subtitle="The only human steps: calls, meetings, approvals and agency filings." />
      <Card title={`Due now (${due.length})`} className="mb-6">{due.length ? list(due) : <Empty>All clear.</Empty>}</Card>
      <Card title={`Upcoming (${later.length})`}>{later.length ? list(later) : <Empty>Nothing scheduled.</Empty>}</Card>
    </>
  );
}
