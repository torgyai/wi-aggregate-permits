import Link from "next/link";
import { Badge, Card, Empty, PageHeader, ScoreBar, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { COMMODITY_LABEL, SIGNAL_LABEL } from "@/lib/enums";
import { fmtDateTime, usd } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import { transportName } from "@/lib/outreach/mailer";
import { getSettings, sendingBlockers } from "@/lib/settings";
import { runTickNow } from "../actions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const s = await getSettings();
  const week = new Date(Date.now() - 7 * 86_400_000);
  const [
    sites,
    withContact,
    openDeals,
    won,
    sent7,
    replies7,
    positive7,
    stages,
    runs,
    signals,
    topLeads,
    pending,
  ] = await Promise.all([
    db.site.count({ where: { mshaStatus: { not: "ABANDONED" } } }),
    db.site.count({ where: { company: { contacts: { some: { email: { not: null } } } } } }),
    db.deal.findMany({ where: { stage: { notIn: ["WON", "LOST"] } }, select: { value: true, stage: true } }),
    db.deal.aggregate({ where: { stage: "WON" }, _sum: { value: true }, _count: true }),
    db.message.count({ where: { direction: "OUT", status: "SENT", sentAt: { gte: week } } }),
    db.message.count({ where: { direction: "IN", createdAt: { gte: week }, classification: { notIn: ["OUT_OF_OFFICE", "BOUNCE"] } } }),
    db.message.count({
      where: { direction: "IN", createdAt: { gte: week }, classification: { in: ["INTERESTED", "MEETING_REQUEST", "PROPOSAL_REQUEST", "QUESTION"] } },
    }),
    db.deal.groupBy({ by: ["stage"], _count: true }),
    db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    db.signal.findMany({ orderBy: { detectedAt: "desc" }, take: 8, include: { site: { select: { id: true, name: true, county: true } } } }),
    db.site.findMany({
      where: { company: { isLargeNational: false, deals: { none: {} } }, mshaStatus: { not: "ABANDONED" } },
      orderBy: { score: "desc" },
      take: 8,
      include: { company: { select: { name: true, _count: { select: { contacts: true } } } } },
    }),
    db.message.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);
  const pipelineValue = openDeals.filter((d) => ["ENGAGED", "MEETING", "PROPOSAL"].includes(d.stage)).reduce((a, d) => a + d.value, 0);
  const stageCount = Object.fromEntries(stages.map((x) => [x.stage, x._count]));
  const blockers = sendingBlockers(s);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Wisconsin aggregate permitting · ${usd(s.packagePrice)} package`}
        actions={
          <form action={runTickNow}>
            <SubmitButton className="btn-secondary" pendingText="Running…">Run autopilot now</SubmitButton>
          </form>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm">
        <span className="font-semibold">Autopilot:</span>
        {s.autopilot ? <Badge tone="green">ON</Badge> : <Badge tone="red">OFF</Badge>}
        <span className="text-stone-400">·</span>
        <span>Mail: <Badge tone={transportName() === "log" ? "amber" : "green"}>{transportName()}</Badge></span>
        <span className="text-stone-400">·</span>
        <span>AI writer: <Badge tone={aiEnabled() ? "green" : "amber"}>{aiEnabled() ? "Claude" : "templates"}</Badge></span>
        <span className="text-stone-400">·</span>
        <span>Replies: <Badge tone="blue">{s.replyMode}</Badge></span>
        {blockers.length > 0 && (
          <Link href="/settings" className="ml-auto text-amber-800 underline">
            {blockers.length} setup item{blockers.length > 1 ? "s" : ""} before live sending →
          </Link>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Sites tracked" value={sites.toLocaleString()} hint={`${withContact} with a contact`} />
        <Stat label="Emails · 7d" value={sent7} hint={`${replies7} replies`} />
        <Stat label="Positive replies · 7d" value={positive7} hint={sent7 ? `${((positive7 / sent7) * 100).toFixed(1)}% of sends` : "—"} tone="good" />
        <Stat label="Meetings / proposals" value={`${stageCount.MEETING ?? 0} / ${stageCount.PROPOSAL ?? 0}`} hint={`${stageCount.ENGAGED ?? 0} engaged`} />
        <Stat label="Live pipeline" value={usd(pipelineValue)} hint="engaged → proposal" tone="warn" />
        <Stat label="Won" value={usd(won._sum.value ?? 0)} hint={`${won._count} deals`} tone="good" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Best leads not yet worked"
          actions={<Link className="link text-sm" href="/sites">All leads →</Link>}
        >
          {topLeads.length === 0 ? (
            <Empty>
              No sites yet. <Link className="link" href="/import">Import the MSHA registry</Link> to load every Wisconsin pit and quarry.
            </Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Operator</th>
                  <th>County</th>
                  <th>Score</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {topLeads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link className="link font-medium" href={`/sites/${l.id}`}>{l.name}</Link>
                      <div className="text-xs text-stone-500">{COMMODITY_LABEL[l.commodity]}</div>
                    </td>
                    <td>{l.company?.name}</td>
                    <td>{l.county}</td>
                    <td><ScoreBar score={l.score} /></td>
                    <td>{l.company?._count.contacts ? <Badge tone="green">yes</Badge> : <Badge>needs contact</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-6">
          {pending > 0 && (
            <Card title="Waiting on you">
              <Link href="/inbox" className="link">{pending} drafted repl{pending === 1 ? "y" : "ies"} to approve →</Link>
            </Card>
          )}
          <Card title="Buying signals">
            {signals.length === 0 ? (
              <Empty>Signals appear after registry syncs (new mines, owner changes, WPDES applications).</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {signals.map((sg) => (
                  <li key={sg.id}>
                    <Badge tone="amber">{SIGNAL_LABEL[sg.type] ?? sg.type}</Badge>{" "}
                    {sg.site ? <Link className="link" href={`/sites/${sg.site.id}`}>{sg.title}</Link> : sg.title}
                    <div className="text-xs text-stone-500">{fmtDateTime(sg.detectedAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Autopilot log">
            {runs.length === 0 ? (
              <Empty>No runs yet.</Empty>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {runs.map((r) => (
                  <li key={r.id} className="flex gap-2">
                    <span className={r.ok ? "text-emerald-600" : "text-red-600"}>{r.ok ? "●" : "✕"}</span>
                    <span className="w-20 shrink-0 text-stone-500">{fmtDateTime(r.startedAt).replace(/, \d{4}/, "")}</span>
                    <span className="text-stone-700">{r.summary ?? r.job}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
