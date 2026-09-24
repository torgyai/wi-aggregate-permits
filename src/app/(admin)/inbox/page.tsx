import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { REPLY_CLASS_LABEL, type ReplyClass } from "@/lib/enums";
import { fmtDateTime, fullName } from "@/lib/format";
import { approveReply, discardReply } from "../../actions";

export const dynamic = "force-dynamic";

const CLASS_TONE: Record<string, "green" | "amber" | "red" | "gray" | "blue" | "violet"> = {
  INTERESTED: "green",
  MEETING_REQUEST: "green",
  PROPOSAL_REQUEST: "green",
  QUESTION: "blue",
  NOT_NOW: "amber",
  REFERRAL: "violet",
  NOT_INTERESTED: "red",
  UNSUBSCRIBE: "red",
  BOUNCE: "gray",
  OUT_OF_OFFICE: "gray",
  OTHER: "gray",
};

export default async function InboxPage() {
  const [pending, received] = await Promise.all([
    db.message.findMany({
      where: { status: { in: ["PENDING_APPROVAL", "FAILED"] }, direction: "OUT", enrollmentId: null },
      include: { contact: { include: { company: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.message.findMany({
      where: { direction: "IN" },
      include: { contact: { include: { company: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const inboundFor = async (inReplyTo: string | null) =>
    inReplyTo ? db.message.findUnique({ where: { providerId: inReplyTo }, select: { body: true, aiSummary: true, classification: true } }) : null;
  const originals = await Promise.all(pending.map((p) => inboundFor(p.inReplyTo)));

  return (
    <>
      <PageHeader title="Inbox" subtitle="Replies are classified and answered automatically. Anything below needs one click from you." />

      <Card title={`Drafted replies waiting for approval (${pending.length})`} className="mb-6">
        {pending.length === 0 ? (
          <Empty>Nothing waiting. Switch reply mode to autopilot in Settings to let confident replies send themselves.</Empty>
        ) : (
          <div className="space-y-6">
            {pending.map((m, i) => (
              <div key={m.id} className="grid gap-4 border-b border-stone-100 pb-6 last:border-0 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm">
                    <strong>{m.contact ? fullName(m.contact) : m.toEmail}</strong>
                    {m.contact?.company && <> · {m.contact.company.name}</>}
                    {originals[i]?.classification && (
                      <> <Badge tone={CLASS_TONE[originals[i]!.classification!]}>{REPLY_CLASS_LABEL[originals[i]!.classification as ReplyClass]}</Badge></>
                    )}
                  </div>
                  <div className="mb-2 text-xs text-stone-500">{originals[i]?.aiSummary}</div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-stone-50 p-3 font-sans text-sm">{originals[i]?.body ?? "(original not found)"}</pre>
                  {m.status === "FAILED" && <p className="mt-2 text-xs text-red-700">Send failed: {m.error}</p>}
                </div>
                <form action={approveReply.bind(null, m.id)} className="space-y-2">
                  <div className="text-xs text-stone-500">{m.subject} · drafted by {m.generatedBy === "ai" ? "Claude" : "template"}</div>
                  <textarea className="input font-sans" name="body" rows={10} defaultValue={m.body} />
                  <div className="flex gap-2">
                    <SubmitButton pendingText="Sending…">Send</SubmitButton>
                    <button formAction={discardReply.bind(null, m.id)} className="btn-secondary">Discard</button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent replies">
        {received.length === 0 ? (
          <Empty>No replies yet. Configure IMAP (or the inbound webhook) so replies flow in.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>When</th><th>From</th><th>Class</th><th>Summary</th></tr></thead>
            <tbody>
              {received.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(m.createdAt)}</td>
                  <td className="text-sm">
                    {m.contact ? fullName(m.contact) : m.fromEmail}
                    <div className="text-xs text-stone-500">{m.contact?.company.name ?? "unmatched"}</div>
                  </td>
                  <td>{m.classification && <Badge tone={CLASS_TONE[m.classification]}>{REPLY_CLASS_LABEL[m.classification as ReplyClass]}</Badge>}</td>
                  <td className="text-sm">
                    {m.aiSummary}
                    {m.dealId && <> · <Link className="link" href={`/deals/${m.dealId}`}>deal</Link></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
