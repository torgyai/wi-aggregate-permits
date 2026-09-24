import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Empty, PageHeader, STAGE_TONE } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { DEAL_STAGES, DEAL_STAGE_LABEL, REPLY_CLASS_LABEL, type DealStage, type ReplyClass } from "@/lib/enums";
import { fmtDateTime, fullName, usd } from "@/lib/format";
import { proposalUrl } from "@/lib/proposals";
import { addNote, createAndSendProposal, draftProposal, setDealStage } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: { id: string } }) {
  const deal = await db.deal.findUnique({
    where: { id: params.id },
    include: {
      company: { include: { contacts: true } },
      site: true,
      proposal: true,
      project: true,
      events: { orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "desc" } },
      tasks: { where: { status: "OPEN" } },
    },
  });
  if (!deal) notFound();
  const contact = deal.company.contacts.find((c) => c.id === deal.primaryContactId);

  const timeline = [
    ...deal.events.map((e) => ({ at: e.createdAt, kind: "event" as const, e })),
    ...deal.messages.map((m) => ({ at: m.createdAt, kind: "msg" as const, m })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <PageHeader
        title={deal.company.name}
        subtitle={
          <>
            {deal.site ? <Link className="link" href={`/sites/${deal.site.id}`}>{deal.site.name}</Link> : "No site"} · {usd(deal.value)} ·{" "}
            <Badge tone={STAGE_TONE[deal.stage]}>{DEAL_STAGE_LABEL[deal.stage as DealStage]}</Badge>
            {deal.lostReason && <span className="text-red-700"> · {deal.lostReason}</span>}
          </>
        }
        actions={deal.project && <Link className="btn" href={`/projects/${deal.project.id}`}>Open project →</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Timeline">
            {timeline.length === 0 ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <ol className="space-y-3">
                {timeline.map((t, i) =>
                  t.kind === "event" ? (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-32 shrink-0 text-xs text-stone-500">{fmtDateTime(t.at)}</span>
                      <span><Badge>{t.e.type.toLowerCase().replace(/_/g, " ")}</Badge> {t.e.detail}</span>
                    </li>
                  ) : (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-32 shrink-0 text-xs text-stone-500">{fmtDateTime(t.at)}</span>
                      <details className="min-w-0 flex-1 rounded border border-stone-200 bg-stone-50 px-3 py-2">
                        <summary className="cursor-pointer">
                          <Badge tone={t.m.direction === "IN" ? "violet" : "blue"}>{t.m.direction === "IN" ? "received" : t.m.status.toLowerCase()}</Badge>{" "}
                          <strong>{t.m.subject}</strong>
                          {t.m.classification && <> · <Badge tone="amber">{REPLY_CLASS_LABEL[t.m.classification as ReplyClass]}</Badge></>}
                          {t.m.aiSummary && <span className="text-xs text-stone-500"> — {t.m.aiSummary}</span>}
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{t.m.body}</pre>
                      </details>
                    </li>
                  ),
                )}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact">
            {contact ? (
              <div className="text-sm">
                <div className="font-medium">{fullName(contact)}</div>
                <div className="text-stone-500">{contact.title}</div>
                <div>{contact.email}</div>
                {contact.phone && <div>{contact.phone}</div>}
              </div>
            ) : (
              <Empty>No primary contact.</Empty>
            )}
          </Card>

          <Card title="Proposal">
            {deal.proposal ? (
              <div className="space-y-2 text-sm">
                <div>
                  <Badge tone={deal.proposal.status === "ACCEPTED" ? "green" : "amber"}>{deal.proposal.status.toLowerCase()}</Badge>{" "}
                  {usd(deal.proposal.price)}
                </div>
                <a className="link break-all" href={proposalUrl(deal.proposal.token)} target="_blank">{proposalUrl(deal.proposal.token)}</a>
                <div className="text-xs text-stone-500">
                  {deal.proposal.sentAt && <>Sent {fmtDateTime(deal.proposal.sentAt)}. </>}
                  {deal.proposal.viewedAt && <>Viewed {fmtDateTime(deal.proposal.viewedAt)}. </>}
                  {deal.proposal.acceptedAt && <>Signed by {deal.proposal.signerName} {fmtDateTime(deal.proposal.acceptedAt)}. </>}
                  {deal.proposal.depositPaidAt && <>Deposit paid {fmtDateTime(deal.proposal.depositPaidAt)}.</>}
                </div>
                {!["ACCEPTED"].includes(deal.proposal.status) && (
                  <form action={createAndSendProposal.bind(null, deal.id)}>
                    <SubmitButton className="btn-secondary w-full">{deal.proposal.status === "DRAFT" ? "Send proposal" : "Re-send proposal"}</SubmitButton>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <form action={draftProposal.bind(null, deal.id)}>
                  <SubmitButton className="btn-secondary w-full">Draft proposal</SubmitButton>
                </form>
                {contact?.email && (
                  <form action={createAndSendProposal.bind(null, deal.id)}>
                    <SubmitButton className="w-full btn" confirm={`Email the ${usd(deal.value)} proposal to ${contact.email}?`}>
                      Create &amp; send proposal
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}
          </Card>

          <Card title="Move stage">
            <form action={setDealStage.bind(null, deal.id)} className="space-y-2">
              <select className="input" name="stage" defaultValue={deal.stage}>
                {DEAL_STAGES.map((st) => <option key={st} value={st}>{DEAL_STAGE_LABEL[st]}</option>)}
              </select>
              <input className="input" name="meetingAt" type="datetime-local" title="Meeting time (for Meeting stage)" />
              <input className="input" name="reason" placeholder="Lost reason (for Lost)" />
              <SubmitButton className="btn-secondary w-full">Update</SubmitButton>
            </form>
          </Card>

          <Card title="Note">
            <form action={addNote.bind(null, deal.id)} className="space-y-2">
              <textarea className="input" name="note" rows={3} placeholder="Call notes, objections, next step…" />
              <SubmitButton className="btn-secondary w-full">Add note</SubmitButton>
            </form>
          </Card>

          {deal.tasks.length > 0 && (
            <Card title="Open tasks">
              <ul className="space-y-1 text-sm">{deal.tasks.map((t) => <li key={t.id}>• {t.title}</li>)}</ul>
              <Link className="link mt-2 block text-sm" href="/tasks">All tasks →</Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
