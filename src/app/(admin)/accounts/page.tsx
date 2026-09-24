import Link from "next/link";
import { Building2, CircleAlert, Download, ExternalLink, Flame, Repeat, Target } from "lucide-react";
import { Badge, Callout, Card, PageHeader, Stat, STAGE_TONE } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { COMMODITY_LABEL, DEAL_STAGE_LABEL, type DealStage } from "@/lib/enums";
import { usd } from "@/lib/format";
import { normalizeCompanyName } from "@/lib/msha";
import { TIERS } from "@/lib/pricing";
import { TARGET_ACCOUNTS, TARGET_TOTALS } from "@/lib/target-accounts";
import { loadTargetAccountsAction } from "../../actions";

export const dynamic = "force-dynamic";

const FIT_TONE = { 5: "green", 4: "indigo", 3: "blue", 2: "gray", 1: "gray" } as const;

export default async function AccountsPage({ searchParams }: { searchParams: { region?: string; tier?: string; fit?: string } }) {
  const companies = await db.company.findMany({
    where: { isTargetAccount: true },
    include: {
      sites: { select: { id: true }, orderBy: { score: "desc" }, take: 1 },
      _count: { select: { contacts: true } },
      deals: { select: { id: true, stage: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const byName = new Map(companies.map((c) => [c.normalizedName, c]));
  const loaded = companies.length > 0;
  const regions = Array.from(new Set(TARGET_ACCOUNTS.map((t) => t.region)));
  const list = TARGET_ACCOUNTS.filter(
    (t) =>
      (!searchParams.region || t.region === searchParams.region) &&
      (!searchParams.tier || t.tier === searchParams.tier) &&
      (!searchParams.fit || t.fit >= Number(searchParams.fit)),
  ).sort((a, b) => b.fit - a.fit || Number(!!b.trigger) - Number(!!a.trigger) || b.price - a.price);
  const byTier = (["T1", "T2", "T3", "T4"] as const).map((k) => ({
    k,
    n: TARGET_ACCOUNTS.filter((t) => t.tier === k).length,
    v: TARGET_ACCOUNTS.filter((t) => t.tier === k).reduce((a, t) => a + t.price, 0),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Researched September 2026"
        title="40 target accounts"
        subtitle="Real Wisconsin pit & quarry operators with a suggested package and monthly plan. Public sources only; prices are estimates to confirm on the call."
        actions={
          <form action={loadTargetAccountsAction}>
            <SubmitButton className="btn" pendingText="Loading…">
              <Download className="h-4 w-4" /> {loaded ? "Refresh in app" : "Load into app"}
            </SubmitButton>
          </form>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Package value (all 40)" value={usd(TARGET_TOTALS.packages)} icon={Target} tone="indigo" />
        <Stat label="Compliance plans if all sign" value={`${usd(TARGET_TOTALS.retainerMonthly)}/mo`} hint={`${usd(TARGET_TOTALS.retainerMonthly * 12)}/yr`} icon={Repeat} tone="emerald" />
        <Stat label="At a 20% win rate" value={usd(TARGET_TOTALS.packages * 0.2)} hint={`+ ${usd(TARGET_TOTALS.retainerMonthly * 12 * 0.2)}/yr recurring`} icon={Building2} tone="amber" />
        <Stat label="Priority (fit 4–5 + live trigger)" value={TARGET_TOTALS.priority.length} hint={usd(TARGET_TOTALS.priority.reduce((a, t) => a + t.price, 0))} icon={Flame} tone="rose" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        {byTier.map((t) => (
          <div key={t.k} className="card p-4">
            <div className="flex items-center justify-between">
              <Badge tone="indigo">{t.k}</Badge>
              <span className="text-xs text-slate-500">{t.n} accounts · {usd(t.v)}</span>
            </div>
            <div className="mt-2 text-sm font-semibold">{TIERS[t.k].name}</div>
            <div className="text-xs text-slate-500">{TIERS[t.k].range[0] === TIERS[t.k].range[1] ? usd(TIERS[t.k].range[0]) : `${usd(TIERS[t.k].range[0])}–${usd(TIERS[t.k].range[1])}`}</div>
            <p className="mt-2 text-xs text-slate-500">{TIERS[t.k].description}</p>
          </div>
        ))}
      </div>

      <Callout tone="amber" icon={CircleAlert}>
        Loading adds the companies and a primary site with their trigger as a signal. It adds <strong>no contacts</strong>, so the autopilot never emails them until you add a decision maker (site page → Contacts, or a CSV).
      </Callout>

      <form className="card my-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Region</label>
          <select className="input" name="region" defaultValue={searchParams.region ?? ""}>
            <option value="">All regions</option>
            {regions.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tier</label>
          <select className="input" name="tier" defaultValue={searchParams.tier ?? ""}>
            <option value="">All tiers</option>
            {Object.entries(TIERS).map(([k, v]) => <option key={k} value={k}>{k} · {v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Minimum fit</label>
          <select className="input" name="fit" defaultValue={searchParams.fit ?? ""}>
            <option value="">Any</option>
            {[5, 4, 3].map((f) => <option key={f} value={f}>{f}+</option>)}
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
        <span className="ml-auto text-sm text-slate-500">{list.length} shown</span>
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        {list.map((t) => {
          const c = byName.get(normalizeCompanyName(t.name));
          const deal = c?.deals[0];
          return (
            <Card key={t.n} className={t.fit >= 4 && t.trigger ? "ring-1 ring-indigo-200" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">#{t.n} · {t.region}</div>
                  <h3 className="mt-0.5 text-base font-semibold text-slate-900">{t.name}</h3>
                  <div className="text-sm text-slate-500">
                    {t.hq} · {t.county} County · {COMMODITY_LABEL[t.commodity]}
                    {t.website && (
                      <> · <a className="link inline-flex items-center gap-0.5" href={`https://${t.website}`} target="_blank" rel="noreferrer">{t.website}<ExternalLink className="h-3 w-3" /></a></>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xl font-semibold tabular-nums">{usd(t.price)}</div>
                  <div className="text-xs text-slate-500">{t.retainer ? `+ ${usd(t.retainer)}/mo plan` : "no plan"}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={FIT_TONE[t.fit]}>fit {t.fit}/5</Badge>
                <Badge tone="indigo">{t.tier} · {TIERS[t.tier].name}</Badge>
                <Badge tone={t.ownership === "Independent" ? "green" : t.ownership === "Regional group" ? "blue" : "gray"}>{t.ownership}</Badge>
                {t.trigger && <Badge tone="amber" dot>live trigger</Badge>}
                {deal && <Badge tone={STAGE_TONE[deal.stage]}>{DEAL_STAGE_LABEL[deal.stage as DealStage]}</Badge>}
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="inline font-medium text-slate-700">What they do: </dt><dd className="inline text-slate-600">{t.what} {t.size !== "Unknown" && `(${t.size})`}</dd></div>
                {t.trigger && <div><dt className="inline font-medium text-amber-700">Trigger: </dt><dd className="inline text-slate-600">{t.trigger}</dd></div>}
                <div><dt className="inline font-medium text-slate-700">Scope: </dt><dd className="inline text-slate-600">{t.scope}</dd></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700"><span className="font-medium">Angle: </span>&ldquo;{t.angle}&rdquo;</div>
                {t.caution && <div className="text-xs text-rose-700">⚠ {t.caution}</div>}
              </dl>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  {t.sources.map((u, i) => (
                    <a key={u} className="inline-flex items-center gap-0.5 text-slate-500 hover:text-indigo-600" href={u} target="_blank" rel="noreferrer">
                      source {i + 1} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
                {c ? (
                  <span className="flex items-center gap-2">
                    <span className="text-slate-500">{c._count.contacts} contact{c._count.contacts === 1 ? "" : "s"}</span>
                    {c.sites[0] && <Link className="btn-secondary px-2.5 py-1 text-xs" href={`/sites/${c.sites[0].id}`}>Open →</Link>}
                  </span>
                ) : (
                  <span className="text-slate-400">not loaded</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
