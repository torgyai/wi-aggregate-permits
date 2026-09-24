import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge, Card, Empty, PageHeader, ScoreBar, STAGE_TONE } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { COMMODITY_LABEL, DEAL_STAGE_LABEL, MSHA_STATUS_LABEL, type DealStage } from "@/lib/enums";
import { WI_COUNTY_NAMES } from "@/lib/wi-counties";
import { createCompanyAndSite } from "../../actions";

export const dynamic = "force-dynamic";
const PAGE = 50;

type Search = { q?: string; county?: string; commodity?: string; status?: string; min?: string; contact?: string; page?: string };

export default async function SitesPage({ searchParams }: { searchParams: Search }) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const where: Prisma.SiteWhereInput = {
    mshaStatus: searchParams.status ? searchParams.status : { not: "ABANDONED" },
    county: searchParams.county || undefined,
    commodity: searchParams.commodity || undefined,
    score: searchParams.min ? { gte: Number(searchParams.min) } : undefined,
    company:
      searchParams.contact === "yes"
        ? { contacts: { some: { email: { not: null } } } }
        : searchParams.contact === "no"
          ? { contacts: { none: { email: { not: null } } } }
          : undefined,
    OR: searchParams.q
      ? [
          { name: { contains: searchParams.q, mode: "insensitive" } },
          { company: { name: { contains: searchParams.q, mode: "insensitive" } } },
          { municipality: { contains: searchParams.q, mode: "insensitive" } },
        ]
      : undefined,
  };
  const [total, sites] = await Promise.all([
    db.site.count({ where }),
    db.site.findMany({
      where,
      orderBy: [{ score: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: {
        company: { select: { name: true, isLargeNational: true, _count: { select: { contacts: true } } } },
        deals: { select: { stage: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { signals: true } },
      },
    }),
  ]);
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...searchParams, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `?${u.toString()}`;
  };

  return (
    <>
      <PageHeader title="Leads" subtitle={`${total.toLocaleString()} Wisconsin pits & quarries, ranked by likelihood to buy now`} />

      <form className="card mb-4 grid grid-cols-2 gap-3 p-3 md:grid-cols-7">
        <input className="input md:col-span-2" name="q" placeholder="Search site, operator, town" defaultValue={searchParams.q} />
        <select className="input" name="county" defaultValue={searchParams.county ?? ""}>
          <option value="">All counties</option>
          {WI_COUNTY_NAMES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input" name="commodity" defaultValue={searchParams.commodity ?? ""}>
          <option value="">All commodities</option>
          {Object.entries(COMMODITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" name="status" defaultValue={searchParams.status ?? ""}>
          <option value="">Any status (not abandoned)</option>
          {Object.entries(MSHA_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" name="contact" defaultValue={searchParams.contact ?? ""}>
          <option value="">Contact: any</option>
          <option value="yes">Has email contact</option>
          <option value="no">Needs contact</option>
        </select>
        <div className="flex gap-2">
          <input className="input w-20" name="min" type="number" min={0} max={100} placeholder="Min" defaultValue={searchParams.min} />
          <button className="btn">Filter</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        {sites.length === 0 ? (
          <div className="p-4"><Empty>No sites match. Load data on the <Link className="link" href="/import">Data</Link> page.</Empty></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Site</th>
                <th>Operator</th>
                <th>County</th>
                <th>Type</th>
                <th>MSHA status</th>
                <th>Signals</th>
                <th>Contact</th>
                <th>Deal</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50">
                  <td><ScoreBar score={s.score} /></td>
                  <td>
                    <Link className="link font-medium" href={`/sites/${s.id}`}>{s.name}</Link>
                    {s.municipality && <div className="text-xs text-stone-500">near {s.municipality}</div>}
                  </td>
                  <td>
                    {s.company?.name ?? "—"} {s.company?.isLargeNational && <Badge tone="gray">national</Badge>}
                  </td>
                  <td>{s.county ?? "—"}</td>
                  <td className="whitespace-nowrap">{COMMODITY_LABEL[s.commodity]}{s.portable && <span className="text-xs text-stone-500"> · portable</span>}</td>
                  <td>{MSHA_STATUS_LABEL[s.mshaStatus]}</td>
                  <td>{s._count.signals ? <Badge tone="amber">{s._count.signals}</Badge> : ""}</td>
                  <td>{s.company?._count.contacts ? <Badge tone="green">{s.company._count.contacts}</Badge> : <span className="text-xs text-stone-400">none</span>}</td>
                  <td>{s.deals[0] && <Badge tone={STAGE_TONE[s.deals[0].stage]}>{DEAL_STAGE_LABEL[s.deals[0].stage as DealStage]}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-stone-500">
        <span>Page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn-secondary" href={qs(page - 1)}>← Prev</Link>}
          {page * PAGE < total && <Link className="btn-secondary" href={qs(page + 1)}>Next →</Link>}
        </div>
      </div>

      <Card title="Add a site by hand" className="mt-6">
        <p className="mb-3 text-sm text-stone-500">For pits not in the MSHA registry yet (a planned site, a referral, a county hearing notice).</p>
        <form action={createCompanyAndSite} className="grid gap-3 md:grid-cols-6">
          <input className="input md:col-span-2" name="company" placeholder="Operator / company" required />
          <input className="input md:col-span-2" name="site" placeholder="Site name" />
          <select className="input" name="county" defaultValue="">
            <option value="">County</option>
            {WI_COUNTY_NAMES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input" name="commodity" defaultValue="SAND_GRAVEL">
            {Object.entries(COMMODITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="isNewSite" /> New site (not yet permitted)</label>
          <div className="md:col-span-4 md:text-right"><SubmitButton>Add site</SubmitButton></div>
        </form>
      </Card>
    </>
  );
}
