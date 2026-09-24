import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, BadgeDollarSign, FileSignature, Mail, NotebookPen, Pause, Play, Send, User, Workflow } from "lucide-react";
import { Badge, Callout, Card, Empty, PageHeader, STAGE_TONE } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { DEAL_STAGES, DEAL_STAGE_LABEL, REPLY_CLASS_LABEL, type DealStage, type ReplyClass } from "@/lib/enums";
import { fmtDateTime, fullName, usd } from "@/lib/format";
import { liveSendEnabled } from "@/lib/outreach/mailer";
import { TIERS } from "@/lib/pricing";
import { proposalUrl } from "@/lib/proposals";
import { quoteForSite } from "@/lib/quote";
import { getSettings } from "@/lib/settings";
import {
  addNote,
  createAndSendProposal,
  draftProposal,
  resetDealPrice,
  sendManualEmail,
  setCompanyExcluded,
  setDealPrice,
  setDealStage,
  setOutreachPaused,
} from "../../../actions";

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
      enrollments: true,
    },
  });
  if (!deal) notFound();
  const s = await getSettings();
  const contact = deal.company.contacts.find((c) => c.id === deal.primaryContactId);
  const engine = deal.siteId ? await quoteForSite(deal.siteId, s) : null;
  const activeSeq = deal.enrollments.find((e) => e.status === "ACTIVE");
  const pausedSeq = deal.enrollments.find((e) => e.status === "PAUSED");

  const timeline = [
    ...deal.events.map((e) => ({ at: e.createdAt, kind: "event" as const, e })),
    ...deal.messages.map((m) => ({ at: m.createdAt, kind: "msg" as const, m })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <PageHeader
        eyebrow="Deal"
        title={deal.company.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {deal.site ? <Link className="link" href={`/sites/${deal.site.id}`}>{deal.site.name}</Link> : "No site"}
            <span>·</span>
            <span className="font-medium text-slate-900">{usd(deal.value)}</span>
            {deal.pricingTier && <Badge tone="indigo">{deal.pricingTier}</Badge>}
            <Badge tone={STAGE_TONE[deal.stage]}>{DEAL_STAGE_LABEL[deal.stage as DealStage]}</Badge>
            {deal.lostReason && <span className="text-rose-700">{deal.lostReason}</span>}
            {deal.company.excluded && <Badge tone="red">excluded</Badge>}
          </span>
        }
        actions={deal.project && <Link className="btn" href={`/projects/${deal.project.id}`}>Open project →</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Email the contact" icon={Mail}>
            {contact?.email ? (
              <form action={sendManualEmail.bind(null, deal.id)} className="space-y-3">
                {!liveSendEnabled() && <Callout tone="emerald">Safe mode: this is recorded on the timeline but not sent.</Callout>}
                <input className="input" name="subject" placeholder="Subject (blank = reply in the last thread)" />
                <textarea className="input" name="body" rows={5} placeholder={`Hi ${contact.firstName ?? "there"},`} required />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">To {contact.email} · your signature and the unsubscribe footer are added</span>
                  <SubmitButton pendingText="Sending…"><Send className="h-4 w-4" /> Send</SubmitButton>
                </div>
              </form>
            ) : (
              <Empty>No contact email yet — add one on the site page.</Empty>
            )}
          </Card>

          <Card title="Timeline" icon={Workflow}>
            {timeline.length === 0 ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {timeline.map((t, i) =>
                  t.kind === "event" ? (
                    <li key={i} className="relative text-sm">
                      <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300" />
                      <div className="text-xs text-slate-400">{fmtDateTime(t.at)}</div>
                      <div><Badge>{t.e.type.toLowerCase().replace(/_/g, " ")}</Badge> <span className="text-slate-600">{t.e.detail}</span></div>
                    </li>
                  ) : (
                    <li key={i} className="relative text-sm">
                      <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${t.m.direction === "IN" ? "bg-violet-500" : "bg-indigo-500"}`} />
                      <div className="text-xs text-slate-400">{fmtDateTime(t.at)}</div>
                      <details className="mt-1 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5">
                        <summary className="cursor-pointer">
                          <Badge tone={t.m.direction === "IN" ? "violet" : "blue"}>{t.m.direction === "IN" ? "received" : t.m.status === "SENT" && !liveSendEnabled() ? "recorded (safe mode)" : t.m.status.toLowerCase().replace("_", " ")}</Badge>{" "}
                          <strong className="font-medium">{t.m.subject}</strong>
                          {t.m.classification && <> · <Badge tone="amber">{REPLY_CLASS_LABEL[t.m.classification as ReplyClass]}</Badge></>}
                          {t.m.aiSummary && <span className="text-xs text-slate-500"> — {t.m.aiSummary}</span>}
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-700">{t.m.body}</pre>
                      </details>
                    </li>
                  ),
                )}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contact" icon={User}>
            {contact ? (
              <div className="text-sm">
                <div className="font-medium">{fullName(contact)}</div>
                <div className="text-slate-500">{contact.title}</div>
                <div className="mt-1">{contact.email}</div>
                {contact.phone && <div>{contact.phone}</div>}
              </div>
            ) : (
              <Empty>No primary contact.</Empty>
            )}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {activeSeq && (
                <form action={setOutreachPaused.bind(null, deal.id, true)}>
                  <button className="btn-secondary px-2.5 py-1.5 text-xs"><Pause className="h-3.5 w-3.5" /> Pause outreach</button>
                </form>
              )}
              {pausedSeq && (
                <form action={setOutreachPaused.bind(null, deal.id, false)}>
                  <button className="btn-secondary px-2.5 py-1.5 text-xs"><Play className="h-3.5 w-3.5" /> Resume outreach</button>
                </form>
              )}
              <form action={setCompanyExcluded.bind(null, deal.companyId, !deal.company.excluded)}>
                <button className="btn-secondary px-2.5 py-1.5 text-xs"><Ban className="h-3.5 w-3.5" /> {deal.company.excluded ? "Un-exclude company" : "Exclude company"}</button>
              </form>
            </div>
            {deal.enrollments[0] && (
              <p className="mt-2 text-xs text-slate-500">Sequence: {deal.enrollments[0].status.toLowerCase()} · step {deal.enrollments[0].currentStep + 1} · next {fmtDateTime(deal.enrollments[0].nextRunAt)}</p>
            )}
          </Card>

          <Card title="Price" icon={BadgeDollarSign}>
            <div className="text-2xl font-semibold tabular-nums">{usd(deal.value)}</div>
            <div className="text-xs text-slate-500">
              {deal.priceOverridden ? "Set by hand / researched" : "From the pricing engine"}
              {deal.retainerMonthly ? ` · plan ${usd(deal.retainerMonthly)}/mo` : ""}
            </div>
            {engine && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-medium text-slate-800">Engine: {usd(engine.price)} · {engine.tier} {engine.tierName}</div>
                <ul className="mt-1 list-disc pl-4">{engine.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
            <form action={setDealPrice.bind(null, deal.id)} className="mt-3 grid grid-cols-2 gap-2">
              <input className="input" name="price" type="number" step="500" placeholder="Price" defaultValue={deal.value} />
              <input className="input" name="retainer" type="number" step="50" placeholder="Plan $/mo" defaultValue={deal.retainerMonthly ?? ""} />
              <select className="input col-span-2" name="tier" defaultValue={deal.pricingTier ?? ""}>
                <option value="">Tier…</option>
                {Object.entries(TIERS).map(([k, v]) => <option key={k} value={k}>{k} · {v.name}</option>)}
              </select>
              <SubmitButton className="btn-secondary col-span-2">Set price</SubmitButton>
            </form>
            {deal.priceOverridden && engine && (
              <form action={resetDealPrice.bind(null, deal.id)} className="mt-2">
                <button className="text-xs text-slate-500 underline">Use engine price ({usd(engine.price)})</button>
              </form>
            )}
          </Card>

          <Card title="Proposal" icon={FileSignature}>
            {deal.proposal ? (
              <div className="space-y-2 text-sm">
                <div>
                  <Badge tone={deal.proposal.status === "ACCEPTED" ? "green" : "indigo"}>{deal.proposal.status.toLowerCase()}</Badge>{" "}
                  <span className="font-medium">{usd(deal.proposal.price)}</span>
                </div>
                <a className="link block truncate" href={proposalUrl(deal.proposal.token)} target="_blank">Open proposal page ↗</a>
                <div className="text-xs text-slate-500">
                  {deal.proposal.sentAt && <>Sent {fmtDateTime(deal.proposal.sentAt)}. </>}
                  {deal.proposal.viewedAt && <>Viewed {fmtDateTime(deal.proposal.viewedAt)}. </>}
                  {deal.proposal.acceptedAt && <>Signed by {deal.proposal.signerName} {fmtDateTime(deal.proposal.acceptedAt)}. </>}
                  {deal.proposal.depositPaidAt && <>Deposit paid. </>}
                  {deal.proposal.balancePaidAt && <>Balance paid.</>}
                </div>
                {deal.proposal.status !== "ACCEPTED" && (
                  <form action={createAndSendProposal.bind(null, deal.id)}>
                    <SubmitButton className="btn-secondary w-full">{deal.proposal.status === "DRAFT" ? "Send proposal" : "Re-issue & re-send"}</SubmitButton>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <form action={draftProposal.bind(null, deal.id)}>
                  <SubmitButton className="btn-secondary w-full">Draft proposal (don&apos;t send)</SubmitButton>
                </form>
                {contact?.email && (
                  <form action={createAndSendProposal.bind(null, deal.id)}>
                    <SubmitButton className="btn w-full" confirm={`Send the ${usd(deal.value)} proposal to ${contact.email}?`}>Create &amp; send proposal</SubmitButton>
                  </form>
                )}
              </div>
            )}
          </Card>

          <Card title="Stage" icon={Workflow}>
            <form action={setDealStage.bind(null, deal.id)} className="space-y-2">
              <select className="input" name="stage" defaultValue={deal.stage}>
                {DEAL_STAGES.map((st) => <option key={st} value={st}>{DEAL_STAGE_LABEL[st]}</option>)}
              </select>
              <input className="input" name="meetingAt" type="datetime-local" title="Meeting time (for Meeting stage)" />
              <input className="input" name="reason" placeholder="Lost reason (for Lost)" />
              <SubmitButton className="btn-secondary w-full">Update stage</SubmitButton>
            </form>
          </Card>

          <Card title="Note" icon={NotebookPen}>
            <form action={addNote.bind(null, deal.id)} className="space-y-2">
              <textarea className="input" name="note" rows={3} placeholder="Call notes, objections, next step…" />
              <SubmitButton className="btn-secondary w-full">Add note</SubmitButton>
            </form>
          </Card>

          {deal.tasks.length > 0 && (
            <Card title="Open tasks">
              <ul className="space-y-1.5 text-sm">{deal.tasks.map((t) => <li key={t.id}>• {t.title}</li>)}</ul>
              <Link className="link mt-2 block text-sm" href="/tasks">All tasks →</Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
