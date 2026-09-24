import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { PERMIT_STATUSES, PERMIT_STATUS_LABEL } from "@/lib/enums";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { intakeUrl } from "@/lib/delivery";
import { completeObligationAction, generateDocsNow, regenerateDoc, setPermitStatus } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params, searchParams }: { params: { id: string }; searchParams: { doc?: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: {
      deal: { include: { company: true, site: true, proposal: true } },
      permits: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      obligations: { orderBy: { dueAt: "asc" } },
    },
  });
  if (!project) notFound();
  const doc = searchParams.doc ? project.documents.find((d) => d.id === searchParams.doc) : null;
  const confirmCount = (md: string) => (md.match(/\[CONFIRM:/g) ?? []).length;

  return (
    <>
      <PageHeader
        title={`${project.deal.company.name} — ${project.deal.site?.name ?? "project"}`}
        subtitle={
          <>
            <Badge tone="blue">{project.status.toLowerCase().replace("_", " ")}</Badge> · signed {fmtDate(project.deal.wonAt)} ·{" "}
            <Link className="link" href={`/deals/${project.dealId}`}>deal</Link>
            {project.deal.proposal?.depositPaidAt ? <> · <Badge tone="green">deposit paid</Badge></> : <> · <Badge tone="amber">deposit pending</Badge></>}
          </>
        }
        actions={
          project.intakeSubmittedAt && (
            <form action={generateDocsNow.bind(null, project.id)}>
              <SubmitButton className="btn-secondary" pendingText="Drafting…">Generate pending drafts</SubmitButton>
            </form>
          )
        }
      />

      {!project.intakeSubmittedAt && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          Waiting on the client&apos;s site questionnaire (reminders go out automatically).{" "}
          <a className="link break-all" href={intakeUrl(project.intakeToken)} target="_blank">{intakeUrl(project.intakeToken)}</a>
        </div>
      )}

      {doc && (
        <Card
          title={doc.title}
          className="mb-6"
          actions={
            <div className="flex gap-2">
              <a className="btn-secondary" href={`/api/docs/${doc.id}`}>Download .md</a>
              {doc.permitKey && (
                <form action={regenerateDoc.bind(null, project.id, doc.permitKey)}>
                  <SubmitButton className="btn-secondary" pendingText="Regenerating…">Regenerate</SubmitButton>
                </form>
              )}
              <Link className="btn-secondary" href={`/projects/${project.id}`}>Close</Link>
            </div>
          }
        >
          <Markdown source={doc.content} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Permits" className="lg:col-span-2">
          {project.permits.length === 0 ? (
            <Empty>Permit list is built from the intake.</Empty>
          ) : (
            <table className="table">
              <thead><tr><th>Permit</th><th>Draft</th><th>Status</th></tr></thead>
              <tbody>
                {project.permits.map((p) => {
                  const d = project.documents.find((x) => x.permitKey === p.key);
                  return (
                    <tr key={p.id} className={p.status === "NOT_REQUIRED" ? "opacity-50" : ""}>
                      <td>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-stone-500">{p.agency}</div>
                        {p.reason && <div className="text-xs text-stone-500">{p.reason}</div>}
                      </td>
                      <td className="text-sm">
                        {d ? (
                          <>
                            <Link className="link" href={`/projects/${project.id}?doc=${d.id}`}>view</Link>
                            {confirmCount(d.content) > 0 && <div className="text-xs text-amber-700">{confirmCount(d.content)} to confirm</div>}
                          </>
                        ) : p.status === "NOT_REQUIRED" ? "—" : <span className="text-xs text-stone-400">queued</span>}
                      </td>
                      <td>
                        <form action={setPermitStatus.bind(null, p.id)} className="flex gap-1">
                          <select className="input py-1 text-xs" name="status" defaultValue={p.status}>
                            {PERMIT_STATUSES.map((st) => <option key={st} value={st}>{PERMIT_STATUS_LABEL[st]}</option>)}
                          </select>
                          <button className="btn-secondary px-2 py-1 text-xs">Set</button>
                        </form>
                        {p.submittedAt && <div className="text-xs text-stone-500">filed {fmtDate(p.submittedAt)}</div>}
                        {p.approvedAt && <div className="text-xs text-emerald-700">approved {fmtDate(p.approvedAt)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Compliance calendar">
            {project.obligations.length === 0 ? (
              <Empty>Built from the intake.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {project.obligations.filter((o) => o.status !== "DONE").map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className={o.status === "OVERDUE" ? "font-medium text-red-700" : "font-medium"}>{o.title}</div>
                      <div className="text-xs text-stone-500">{fmtDate(o.dueAt)} · {o.cadence.toLowerCase()} · {o.citation}</div>
                    </div>
                    <form action={completeObligationAction.bind(null, o.id, project.id)}>
                      <button className="btn-secondary px-2 py-0.5 text-xs">Done</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Drafts">
            {project.documents.length === 0 ? (
              <Empty>Drafts generate automatically after intake (a few per autopilot run).</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {project.documents.map((d) => (
                  <li key={d.id}>
                    <Link className="link" href={`/projects/${project.id}?doc=${d.id}`}>{d.title}</Link>
                    <span className="text-xs text-stone-500"> · {d.generatedBy} · {fmtDateTime(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {project.intake && (
            <Card title="Intake answers">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {Object.entries(project.intake as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-stone-500">{k}</dt>
                    <dd className="break-words">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
