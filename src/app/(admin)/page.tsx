import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleAlert,
  Mail,
  MapPin,
  MessageSquareReply,
  Radar,
  Repeat,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Badge, Callout, Card, Empty, PageHeader, ScoreBar, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { COMMODITY_LABEL, SIGNAL_LABEL } from "@/lib/enums";
import { fmtDateTime, usd } from "@/lib/format";
import { aiEnabled } from "@/lib/ai";
import { liveSendEnabled } from "@/lib/outreach/mailer";
import { getSettings } from "@/lib/settings";
import { runTickNow } from "../actions";

export const dynamic = "force-dynamic";

const FUNNEL = [
  { key: "CONTACTED", label: "Contacted" },
  { key: "ENGAGED", label: "Replied" },
  { key: "MEETING", label: "Meeting" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "WON", label: "Won" },
];

export default async function Dashboard() {
  const s = await getSettings();
  const week = new Date(Date.now() - 7 * 86_400_000);
  const [sites, withContact, openDeals, won, sent7, replies7, positive7, stages, runs, signals, topLeads, pending, dueTasks, retainers, targets] =
    await Promise.all([
      db.site.count({ where: { mshaStatus: { not: "ABANDONED" } } }),
      db.site.count({ where: { company: { contacts: { some: { email: { not: null } } } } } }),
      db.deal.findMany({ where: { stage: { notIn: ["WON", "LOST"] } }, select: { value: true, stage: true } }),
      db.deal.aggregate({ where: { stage: "WON" }, _sum: { value: true }, _count: true }),
      db.message.count({ where: { direction: "OUT", status: "SENT", sentAt: { gte: week } } }),
      db.message.count({ where: { direction: "IN", createdAt: { gte: week }, classification: { notIn: ["OUT_OF_OFFICE", "BOUNCE"] } } }),
      db.message.count({
        where: { direction: "IN", createdAt: { gte: week }, classification: { in: ["INTERESTED", "MEETING_REQUEST", "PROPOSAL_REQUEST", "QUESTION"] } },
      }),
      db.deal.groupBy({ by: ["stage"], _count: true, _sum: { value: true } }),
      db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
      db.signal.findMany({ orderBy: { detectedAt: "desc" }, take: 6, include: { site: { select: { id: true, name: true } } } }),
      db.site.findMany({
        where: { company: { isLargeNational: false, excluded: false, deals: { none: {} } }, mshaStatus: { not: "ABANDONED" } },
        orderBy: { score: "desc" },
        take: 7,
        include: { company: { select: { name: true, suggestedPrice: true, _count: { select: { contacts: true } } } } },
      }),
      db.message.count({ where: { status: "PENDING_APPROVAL" } }),
      db.task.count({ where: { status: "OPEN", dueAt: { lte: new Date() } } }),
      db.project.findMany({ where: { retainerActive: true }, include: { deal: { select: { retainerMonthly: true } } } }),
      db.company.aggregate({ where: { isTargetAccount: true }, _sum: { suggestedPrice: true }, _count: true }),
    ]);
  const byStage = Object.fromEntries(stages.map((x) => [x.stage, { n: x._count, v: x._sum.value ?? 0 }]));
  const pipelineValue = openDeals.filter((d) => ["ENGAGED", "MEETING", "PROPOSAL"].includes(d.stage)).reduce((a, d) => a + d.value, 0);
  const mrr = retainers.reduce((a, p) => a + (p.deal.retainerMonthly ?? 0), 0);
  // Funnel counts deals that reached a stage (a won deal also passed every earlier stage).
  const order = ["CONTACTED", "ENGAGED", "MEETING", "PROPOSAL", "WON"];
  const reached = (k: string) => order.slice(order.indexOf(k)).reduce((a, st) => a + (byStage[st]?.n ?? 0), 0);
  const funnelMax = Math.max(1, reached("CONTACTED"));

  return (
    <>
      <PageHeader
        eyebrow="Wisconsin aggregate permitting"
        title="Good day — here's the machine."
        subtitle={`Standard package ${usd(s.packagePrice)} · tiers from $15k to $150k · autopilot ${s.autopilot ? "running" : "paused"}`}
        actions={
          <form action={runTickNow}>
            <SubmitButton className="btn" pendingText="Running…">
              <Sparkles className="h-4 w-4" /> Run autopilot now
            </SubmitButton>
          </form>
        }
      />

      {(pending > 0 || dueTasks > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {pending > 0 && (
            <Link href="/inbox" className="card flex items-center gap-3 p-4 transition hover:border-indigo-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><MessageSquareReply className="h-5 w-5" /></div>
              <div className="flex-1"><div className="font-medium">{pending} drafted repl{pending === 1 ? "y" : "ies"} to approve</div><div className="text-xs text-slate-500">One click each in the Inbox</div></div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          )}
          {dueTasks > 0 && (
            <Link href="/tasks" className="card flex items-center gap-3 p-4 transition hover:border-indigo-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><CircleAlert className="h-5 w-5" /></div>
              <div className="flex-1"><div className="font-medium">{dueTasks} task{dueTasks === 1 ? "" : "s"} due</div><div className="text-xs text-slate-500">Calls, meetings, filings</div></div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          )}
        </div>
      )}

      {!liveSendEnabled() && (
        <div className="mb-6">
          <Callout tone="emerald" icon={CheckCircle2}>
            <strong>Safe mode.</strong> The autopilot writes and records every email so you can test the whole workflow, but nothing is sent. Going live is the last step of the{" "}
            <Link href="/launch" className="font-medium underline">launch checklist</Link>.
          </Callout>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Sites tracked" value={sites.toLocaleString()} hint={`${withContact} with a contact`} icon={MapPin} tone="sky" />
        <Stat label="Emails · 7 days" value={sent7} hint={`${replies7} replies`} icon={Mail} tone="indigo" />
        <Stat label="Positive replies" value={positive7} hint={sent7 ? `${((positive7 / sent7) * 100).toFixed(1)}% of sends` : "last 7 days"} icon={MessageSquareReply} tone="violet" />
        <Stat label="Live pipeline" value={usd(pipelineValue)} hint="replied → proposal" icon={BadgeDollarSign} tone="amber" />
        <Stat label="Won" value={usd(won._sum.value ?? 0)} hint={`${won._count} deal${won._count === 1 ? "" : "s"}`} icon={Trophy} tone="emerald" />
        <Stat label="Compliance MRR" value={usd(mrr)} hint={`${retainers.length} plan${retainers.length === 1 ? "" : "s"}`} icon={Repeat} tone="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Funnel" icon={Activity}>
            <div className="space-y-2.5">
              {FUNNEL.map((f) => {
                const n = reached(f.key);
                return (
                  <div key={f.key} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-slate-600">{f.label}</div>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                      <div
                        className="flex h-full items-center rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-2 text-xs font-medium text-white"
                        style={{ width: `${Math.max(n ? 6 : 0, (n / funnelMax) * 100)}%` }}
                      >
                        {n || ""}
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm tabular-nums text-slate-500">{usd(byStage[f.key]?.v ?? 0)}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Best leads not yet worked" icon={Radar} actions={<Link className="link text-sm" href="/sites">All leads →</Link>} padded={false}>
            {topLeads.length === 0 ? (
              <div className="p-5">
                <Empty icon={MapPin}>
                  No leads yet. Load the <Link className="link" href="/accounts">40 target accounts</Link> or <Link className="link" href="/import">sync the MSHA registry</Link>.
                </Empty>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>Site</th><th>County</th><th>Score</th><th>Est. price</th><th>Contact</th></tr></thead>
                <tbody>
                  {topLeads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link className="font-medium text-slate-900 hover:text-indigo-600" href={`/sites/${l.id}`}>{l.company?.name ?? l.name}</Link>
                        <div className="text-xs text-slate-500">{l.name} · {COMMODITY_LABEL[l.commodity]}</div>
                      </td>
                      <td className="text-slate-600">{l.county}</td>
                      <td><ScoreBar score={l.score} /></td>
                      <td className="tabular-nums text-slate-600">{l.company?.suggestedPrice ? usd(l.company.suggestedPrice) : "—"}</td>
                      <td>{l.company?._count.contacts ? <Badge tone="green" dot>ready</Badge> : <Badge>needs contact</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {targets._count > 0 && (
            <Link href="/accounts" className="card block bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white transition hover:shadow-lg">
              <div className="text-xs font-medium uppercase tracking-wider text-indigo-100">Target accounts</div>
              <div className="mt-1 text-3xl font-semibold">{usd(targets._sum.suggestedPrice ?? 0)}</div>
              <div className="mt-1 text-sm text-indigo-100">{targets._count} researched Wisconsin operators · open list →</div>
            </Link>
          )}
          <Card title="Buying signals" icon={Radar}>
            {signals.length === 0 ? (
              <Empty>Signals appear after registry syncs: new mines, owner changes, WDNR applications, hearings.</Empty>
            ) : (
              <ul className="space-y-3 text-sm">
                {signals.map((sg) => (
                  <li key={sg.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <div className="min-w-0">
                      <Badge tone="amber">{SIGNAL_LABEL[sg.type] ?? sg.type}</Badge>
                      <div className="mt-1 line-clamp-2 text-slate-700">
                        {sg.site ? <Link className="hover:text-indigo-600" href={`/sites/${sg.site.id}`}>{sg.title}</Link> : sg.title}
                      </div>
                      <div className="text-xs text-slate-400">{fmtDateTime(sg.detectedAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Autopilot log" icon={Activity}>
            {runs.length === 0 ? (
              <Empty>No runs yet.</Empty>
            ) : (
              <ul className="space-y-2 text-xs">
                {runs.map((r) => (
                  <li key={r.id} className="flex gap-2">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${r.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="w-24 shrink-0 text-slate-400">{fmtDateTime(r.startedAt).replace(/, \d{4}/, "")}</span>
                    <span className="text-slate-600">{r.summary ?? r.job}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Writer: {aiEnabled() ? "Claude" : "templates (add ANTHROPIC_API_KEY for Claude)"} · Replies: {s.replyMode}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
