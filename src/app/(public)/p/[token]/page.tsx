import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { fmtDate, usd } from "@/lib/format";
import { markViewed, stripeEnabled, type ProposalScope } from "@/lib/proposals";
import { getSettings } from "@/lib/settings";
import { acceptProposalAction, declineProposalAction, payDepositAction } from "../../../actions";

export const dynamic = "force-dynamic";

const STATUS_WORD: Record<string, string> = { REQUIRED: "Required", LIKELY: "Likely required", CHECK: "Confirm & handle if needed" };

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { accepted?: string; declined?: string; paid?: string; error?: string };
}) {
  const p = await db.proposal.findUnique({ where: { token: params.token }, include: { deal: { include: { company: true } } } });
  if (!p) notFound();
  await markViewed(params.token);
  const s = await getSettings();
  const scope = p.scope as unknown as ProposalScope;
  const accepted = p.status === "ACCEPTED";
  const expired = p.status === "EXPIRED" || (!accepted && p.expiresAt < new Date());
  const deposit = (p.price * p.depositPct) / 100;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="card overflow-hidden">
        <div className="bg-stone-900 px-8 py-8 text-white">
          <div className="text-xs uppercase tracking-widest text-amber-300">{s.companyName} · Proposal</div>
          <h1 className="mt-2 text-3xl font-bold">{scope.packageName}</h1>
          <p className="mt-2 text-stone-300">
            Prepared for {scope.clientName}
            {scope.siteName && <> · {scope.siteName}</>}
            {scope.county && <> · {scope.county} County, Wisconsin</>}
          </p>
          <div className="mt-6 flex flex-wrap gap-8">
            <div>
              <div className="text-xs uppercase text-stone-400">Fixed fee</div>
              <div className="text-2xl font-bold">{usd(p.price)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-stone-400">Typical timeline</div>
              <div className="text-2xl font-bold">{scope.timelineWeeks[0]}–{scope.timelineWeeks[1]} weeks</div>
            </div>
            <div>
              <div className="text-xs uppercase text-stone-400">Valid until</div>
              <div className="text-2xl font-bold">{fmtDate(p.expiresAt)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-8 px-8 py-8">
          {searchParams.paid && <p className="rounded bg-emerald-50 px-4 py-3 text-emerald-800">Deposit received — thank you. We&apos;re underway.</p>}
          {searchParams.declined && <p className="rounded bg-stone-100 px-4 py-3">Understood — thanks for considering us.</p>}

          <section>
            <h2 className="mb-2 text-lg font-semibold">What you get</h2>
            <p className="text-stone-700">
              We prepare, file and see through every approval your site needs, and deal with the county and WDNR directly. You review and sign; we write, file, answer comments and chase decisions. Permits run in parallel, so the slowest approval sets your start date instead of the sum of all of them.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Approvals in scope</h2>
            <div className="space-y-4">
              {scope.included.map((i) => (
                <div key={i.key} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{i.name}</h3>
                    <span className="text-xs font-medium uppercase text-amber-800">{STATUS_WORD[i.status] ?? i.status}</span>
                  </div>
                  <div className="text-xs text-stone-500">{i.agency} · {i.citation}</div>
                  <p className="mt-1 text-sm text-stone-600">{i.reason}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-stone-700">
                    {i.deliverables.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Also included</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
              {scope.alsoIncluded.map((x) => <li key={x}>{x}</li>)}
            </ul>
            {scope.optional.length > 0 && (
              <p className="mt-3 text-sm text-stone-600">
                Recommended add-on{scope.optional.length > 1 ? "s" : ""}: {scope.optional.map((o) => o.name).join("; ")} — quoted separately if wanted.
              </p>
            )}
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="mb-2 text-lg font-semibold">Fee &amp; payment</h2>
              <p className="text-sm text-stone-700">{usd(p.price)} fixed. {scope.paymentTerms}</p>
              {scope.retainer.monthly > 0 && (
                <p className="mt-2 text-sm text-stone-600">
                  Optional compliance plan: {usd(scope.retainer.monthly)}/month. {scope.retainer.description}
                </p>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold">Not included</h2>
              <ul className="list-disc space-y-1 pl-5 text-xs text-stone-600">
                {scope.exclusions.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          </section>

          <section className="text-xs text-stone-500">
            Terms: Work begins on signature{p.depositPct > 0 ? " and receipt of the deposit" : ""}. We don&apos;t control agency decisions or review times; the fee covers
            preparing, filing and responding to comments through a decision on each approval in scope. If site conditions discovered during intake add an
            approval not listed above, we&apos;ll quote it before starting it. Either party may end the engagement with written notice; fees for work completed
            to that point remain due. Wisconsin law governs.
          </section>

          <section id="accept" className="rounded-lg border-2 border-amber-200 bg-amber-50 p-6">
            {accepted ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-emerald-800">Accepted {fmtDate(p.acceptedAt)} by {p.signerName}</h2>
                <p className="text-sm">We&apos;ve emailed a short site questionnaire — that&apos;s the only thing we need from you to start drafting.</p>
                {stripeEnabled() && !p.depositPaidAt && p.depositPct > 0 && (
                  <form action={payDepositAction.bind(null, params.token)}>
                    <SubmitButton pendingText="Opening checkout…">Pay {usd(deposit)} deposit</SubmitButton>
                  </form>
                )}
                {p.depositPaidAt && <p className="text-sm text-emerald-800">Deposit received {fmtDate(p.depositPaidAt)}.</p>}
              </div>
            ) : expired ? (
              <p className="text-sm">This proposal has expired. Reply to our email and we&apos;ll reissue it.</p>
            ) : p.status === "DECLINED" ? (
              <p className="text-sm">This proposal was declined.</p>
            ) : (
              <>
                <h2 className="mb-1 text-lg font-semibold">Accept &amp; sign</h2>
                <p className="mb-4 text-sm text-stone-600">
                  Typing your name below is your electronic signature on this proposal and its terms.
                  {stripeEnabled() && p.depositPct > 0 && <> You&apos;ll then be taken to a secure page to pay the {usd(deposit)} deposit (bank transfer or card).</>}
                </p>
                {searchParams.error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>}
                <form action={acceptProposalAction.bind(null, params.token)} className="grid gap-3 md:grid-cols-3">
                  <input className="input" name="name" placeholder="Full name" required minLength={3} />
                  <input className="input" name="title" placeholder="Title (e.g. Owner)" />
                  <input className="input" name="email" type="email" placeholder="Email" required />
                  <label className="flex items-start gap-2 text-sm md:col-span-3">
                    <input type="checkbox" name="agree" required className="mt-0.5" />
                    I&apos;m authorized to sign for {scope.clientName} and accept this proposal and its terms.
                  </label>
                  <div className="md:col-span-3">
                    <SubmitButton pendingText="Signing…">Accept proposal — {usd(p.price)}</SubmitButton>
                  </div>
                </form>
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-stone-500">Not the right fit?</summary>
                  <form action={declineProposalAction.bind(null, params.token)} className="mt-2 flex gap-2">
                    <input className="input" name="reason" placeholder="What would have to change? (optional)" />
                    <button className="btn-secondary">Decline</button>
                  </form>
                </details>
              </>
            )}
          </section>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-stone-500">
        {s.companyName}
        {s.physicalAddress && <> · {s.physicalAddress}</>}
        {s.phone && <> · {s.phone}</>}
      </p>
    </div>
  );
}
