import { notFound, redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, CircleDot, FileText, Mountain, Repeat, Wallet } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { PERMIT_STATUS_LABEL } from "@/lib/enums";
import { fmtDate, usd } from "@/lib/format";
import { paymentAmount, stripeEnabled } from "@/lib/proposals";
import { getSettings } from "@/lib/settings";
import { clientReviewAction, payBalanceAction, startPlanAction } from "../../../actions";

export const dynamic = "force-dynamic";

const STEPS = [
  { key: "INTAKE", label: "Questionnaire" },
  { key: "DRAFTING", label: "Drafting" },
  { key: "CLIENT_REVIEW", label: "Your review" },
  { key: "FILING", label: "Filing" },
  { key: "AGENCY_REVIEW", label: "Agency review" },
  { key: "COMPLIANCE", label: "Approved" },
];

const STATUS_TONE: Record<string, "green" | "indigo" | "amber" | "gray" | "blue"> = {
  APPROVED: "green",
  SUBMITTED: "blue",
  AGENCY_REVIEW: "blue",
  READY_TO_FILE: "indigo",
  CLIENT_REVIEW: "amber",
};

/** Client portal: project status, drafts to review and approve, compliance calendar, payments. */
export default async function PortalPage({ params, searchParams }: { params: { token: string }; searchParams: { doc?: string; reviewed?: string; plan?: string; paid?: string; welcome?: string } }) {
  const project = await db.project.findUnique({
    where: { intakeToken: params.token },
    include: {
      deal: { include: { company: true, site: true, proposal: true } },
      permits: { where: { status: { not: "NOT_REQUIRED" } }, orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
      obligations: { where: { status: { not: "DONE" } }, orderBy: { dueAt: "asc" }, take: 12 },
    },
  });
  if (!project) notFound();
  if (!project.intakeSubmittedAt) redirect(`/intake/${params.token}`);
  const s = await getSettings();
  const shared = !!project.sharedAt;
  const doc = shared && searchParams.doc ? project.documents.find((d) => d.id === searchParams.doc) : null;
  const stepIdx = Math.max(0, STEPS.findIndex((x) => x.key === project.status));
  const p = project.deal.proposal;
  const planPrice = project.deal.retainerMonthly ?? p?.retainerMonthly ?? s.retainerMonthly;
  const balanceDue = p && !p.balancePaidAt && ["FILING", "AGENCY_REVIEW", "COMPLIANCE"].includes(project.status) && p.depositPct < 100;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600"><Mountain className="h-4 w-4 text-white" /></div>
        <div>
          <div className="text-sm font-semibold">{s.companyName}</div>
          <div className="text-xs text-slate-500">Client portal</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 px-8 py-8 text-white">
          <div className="text-xs uppercase tracking-widest text-indigo-300">Permitting project</div>
          <h1 className="mt-1 text-2xl font-semibold">{project.deal.site?.name ?? project.deal.company.name}</h1>
          <p className="text-sm text-slate-300">{project.deal.company.name}{project.deal.site?.county && ` · ${project.deal.site.county} County, Wisconsin`}</p>
          <ol className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6">
            {STEPS.map((st, i) => (
              <li key={st.key} className="text-xs">
                <div className={`h-1.5 rounded-full ${i <= stepIdx ? "bg-indigo-400" : "bg-white/15"}`} />
                <div className={`mt-1.5 ${i === stepIdx ? "font-semibold text-white" : "text-slate-400"}`}>{st.label}</div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-8 p-8">
          {searchParams.welcome && <Banner>Thanks — questionnaire received. We&apos;re drafting now; you&apos;ll get an email when the drafts are ready to review.</Banner>}
          {searchParams.reviewed && <Banner>Thanks — we got your review.</Banner>}
          {searchParams.plan && <Banner>Compliance plan started. We&apos;ll take care of every item on your calendar from here.</Banner>}
          {searchParams.paid && <Banner>Payment received — thank you.</Banner>}

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><CircleDot className="h-4 w-4 text-indigo-500" /> Your permits</h2>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {project.permits.map((pm) => (
                <div key={pm.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{pm.name}</div>
                    <div className="text-xs text-slate-500">{pm.agency}</div>
                  </div>
                  <Badge tone={STATUS_TONE[pm.status] ?? "gray"}>{PERMIT_STATUS_LABEL[pm.status]}</Badge>
                </div>
              ))}
            </div>
          </section>

          <section id="docs">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-indigo-500" /> Drafts for your review</h2>
            {!shared ? (
              <p className="text-sm text-slate-500">We&apos;re preparing your drafts. You&apos;ll get an email as soon as they&apos;re ready.</p>
            ) : (
              <div className="space-y-2">
                {project.documents.map((d) => {
                  const confirms = (d.content.match(/\[CONFIRM:/g) ?? []).length;
                  return (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
                      <div>
                        <a href={`?doc=${d.id}#reader`} className="text-sm font-medium text-indigo-700 hover:underline">{d.title.replace(" — working draft", "")}</a>
                        <div className="text-xs text-slate-500">{confirms > 0 ? `${confirms} item${confirms > 1 ? "s" : ""} need your answer` : "No open questions"}</div>
                      </div>
                      {d.clientApprovedAt ? <Badge tone="green">approved {fmtDate(d.clientApprovedAt)}</Badge> : <Badge tone="amber">needs review</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
            {doc && (
              <div id="reader" className="mt-6 rounded-2xl border border-slate-200 p-6">
                <Markdown source={doc.content} />
                <form action={clientReviewAction.bind(null, params.token, doc.id)} className="mt-6 space-y-3 border-t border-slate-100 pt-4">
                  <label className="label">Answers to the highlighted CONFIRM items, corrections or questions</label>
                  <textarea className="input" name="comment" rows={4} defaultValue={doc.clientComment ?? ""} />
                  <div className="flex flex-wrap gap-2">
                    <button name="decision" value="approve" className="btn"><CheckCircle2 className="h-4 w-4" /> Approve this draft</button>
                    <button name="decision" value="comment" className="btn-secondary">Send comments only</button>
                  </div>
                </form>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-indigo-500" /> Your compliance calendar</h2>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {project.obligations.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>{o.title}</span>
                  <span className={o.status === "OVERDUE" ? "font-medium text-rose-700" : "text-slate-500"}>{fmtDate(o.dueAt)}</span>
                </div>
              ))}
            </div>
            {!project.retainerActive && planPrice > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <Repeat className="h-5 w-5 text-indigo-600" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Let us handle all of this — {usd(planPrice)}/month</div>
                  <div className="text-slate-600">Annual reclamation report and fee, storm water inspections and eDMRs, air records, MSHA reports. Month to month, cancel anytime.</div>
                </div>
                <form action={startPlanAction.bind(null, params.token)}>
                  <SubmitButton>Start compliance plan</SubmitButton>
                </form>
              </div>
            )}
          </section>

          {p && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-indigo-500" /> Payments</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Pay label="Deposit" amount={paymentAmount(p, "deposit")} paidAt={p.depositPaidAt} />
                <Pay label="Balance (at filing)" amount={paymentAmount(p, "balance")} paidAt={p.balancePaidAt} />
              </div>
              {balanceDue && stripeEnabled() && (
                <form action={payBalanceAction.bind(null, params.token)} className="mt-3">
                  <SubmitButton>Pay balance — {usd(paymentAmount(p, "balance"))}</SubmitButton>
                </form>
              )}
            </section>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">{s.companyName}{s.phone && ` · ${s.phone}`}{s.physicalAddress && ` · ${s.physicalAddress}`}</p>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{children}</div>;
}

function Pay({ label, amount, paidAt }: { label: string; amount: number; paidAt: Date | null }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{usd(amount)}</div>
      {paidAt ? <Badge tone="green">paid {fmtDate(paidAt)}</Badge> : <Badge tone="gray">open</Badge>}
    </div>
  );
}
