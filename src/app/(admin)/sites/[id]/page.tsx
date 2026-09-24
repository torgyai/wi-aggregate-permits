import Link from "next/link";
import { notFound } from "next/navigation";
import { APPLICABILITY_TONE, Badge, Card, Empty, PageHeader, ScoreBar, STAGE_TONE } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { COMMODITY_LABEL, DEAL_STAGE_LABEL, MSHA_STATUS_LABEL, SIGNAL_LABEL, type DealStage } from "@/lib/enums";
import { fmtDate, fullName, usd } from "@/lib/format";
import { buildLeadContext } from "@/lib/outreach/context";
import { composeBody } from "@/lib/outreach/mailer";
import { writeEmail } from "@/lib/outreach/personalize";
import { getSequence, DEFAULT_SEQUENCE_KEY } from "@/lib/outreach/sequence";
import { assessNeeds, estimateTimelineWeeks, profileFromSite, signalFlags } from "@/lib/permits/catalog";
import { getSettings } from "@/lib/settings";
import { addContact, addSignal, enrollSite, updateSiteFacts } from "../../../actions";

export const dynamic = "force-dynamic";

const tri = (v: boolean | null) => (v === true ? "yes" : v === false ? "no" : "");

export default async function SitePage({ params, searchParams }: { params: { id: string }; searchParams: { preview?: string } }) {
  const site = await db.site.findUnique({
    where: { id: params.id },
    include: {
      company: {
        include: {
          contacts: { include: { enrollments: true }, orderBy: { createdAt: "asc" } },
          sites: { select: { id: true, name: true, county: true, score: true }, orderBy: { score: "desc" } },
        },
      },
      signals: { orderBy: { detectedAt: "desc" } },
      deals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!site) notFound();
  const s = await getSettings();
  const needs = assessNeeds(profileFromSite(site, signalFlags(site.signals)));
  const [lo, hi] = estimateTimelineWeeks(needs);
  const reasons = (site.scoreReasons as { points: number; reason: string }[]) ?? [];
  const emailContact = site.company?.contacts.find((c) => c.email && !c.doNotContact);

  let preview: { subject: string; body: string; by: string } | null = null;
  if (searchParams.preview && emailContact) {
    const ctx = await buildLeadContext(emailContact.id, site.id, s);
    const step = getSequence(DEFAULT_SEQUENCE_KEY).steps[0];
    const w = await writeEmail(ctx, step, []);
    preview = { subject: w.subject, body: composeBody(w.body, s, emailContact.email!), by: w.generatedBy };
  }

  return (
    <>
      <PageHeader
        title={site.name}
        subtitle={
          <>
            {site.company?.name ?? "Unknown operator"} · {site.county ?? "?"} County · {COMMODITY_LABEL[site.commodity]} ·{" "}
            {MSHA_STATUS_LABEL[site.mshaStatus]}
            {site.mshaMineId && <> · MSHA {site.mshaMineId}</>}
          </>
        }
        actions={
          <>
            {emailContact && (
              <Link className="btn-secondary" href={`/sites/${site.id}?preview=1`}>Preview first email</Link>
            )}
            {emailContact && !site.deals.some((d) => !["WON", "LOST"].includes(d.stage)) && (
              <form action={enrollSite.bind(null, site.id)}>
                <SubmitButton>Start outreach now</SubmitButton>
              </form>
            )}
          </>
        }
      />

      {preview && (
        <Card title={`First email preview (${preview.by === "ai" ? "Claude" : "template"})`} className="mb-6">
          <div className="mb-2 text-sm"><span className="text-stone-500">Subject:</span> <strong>{preview.subject}</strong></div>
          <pre className="whitespace-pre-wrap rounded bg-stone-50 p-3 font-sans text-sm">{preview.body}</pre>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Permit needs — typical path ${lo}–${hi} weeks`}>
            <table className="table">
              <thead>
                <tr><th>Approval</th><th>Agency</th><th>Status</th><th>Why</th></tr>
              </thead>
              <tbody>
                {needs.map((n) => (
                  <tr key={n.key} className={n.status === "NO" ? "opacity-50" : ""}>
                    <td className="font-medium">{n.shortName}<div className="text-xs font-normal text-stone-500">{n.citation}</div></td>
                    <td className="text-xs">{n.agency}</td>
                    <td><Badge tone={APPLICABILITY_TONE[n.status]}>{n.status.toLowerCase()}</Badge></td>
                    <td className="text-xs text-stone-600">{n.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Contacts">
            {site.company ? (
              <>
                {site.company.contacts.length === 0 ? (
                  <Empty>No contacts yet. Add one below, import a CSV, or let Apollo enrichment find the owner.</Empty>
                ) : (
                  <table className="table mb-4">
                    <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Source</th><th>Sequence</th></tr></thead>
                    <tbody>
                      {site.company.contacts.map((c) => (
                        <tr key={c.id}>
                          <td>{fullName(c)}</td>
                          <td className="text-xs">{c.title}</td>
                          <td className="text-xs">{c.email}{c.doNotContact && <> <Badge tone="red">do not contact</Badge></>}{c.emailStatus === "BOUNCED" && <> <Badge tone="red">bounced</Badge></>}</td>
                          <td className="text-xs">{c.source}</td>
                          <td className="text-xs">{c.enrollments.map((e) => `${e.status.toLowerCase()} · step ${e.currentStep + 1}`).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <form action={addContact.bind(null, site.company.id)} className="grid gap-2 md:grid-cols-6">
                  <input className="input" name="firstName" placeholder="First" />
                  <input className="input" name="lastName" placeholder="Last" />
                  <input className="input md:col-span-2" name="email" type="email" placeholder="email@company.com" required />
                  <input className="input" name="title" placeholder="Title" />
                  <SubmitButton className="btn-secondary">Add contact</SubmitButton>
                </form>
              </>
            ) : (
              <Empty>No operator on record.</Empty>
            )}
          </Card>

          <Card title="Site facts (sharpen the permit list)">
            <form action={updateSiteFacts.bind(null, site.id)} className="grid gap-3 md:grid-cols-6">
              {(
                [
                  ["plannedExpansion", "Expansion planned", site.plannedExpansion],
                  ["crushing", "Crushing on site", site.crushing],
                  ["washing", "Wash plant", site.washing],
                  ["dewatering", "Dewatering", site.dewatering],
                  ["blasting", "Blasting", site.blasting],
                ] as const
              ).map(([k, label, val]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <select className="input" name={k} defaultValue={tri(val)}>
                    <option value="">unknown</option>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </div>
              ))}
              <div>
                <label className="label">Acres</label>
                <input className="input" name="acreage" type="number" step="0.1" defaultValue={site.acreage ?? ""} />
              </div>
              <div className="md:col-span-6 text-right"><SubmitButton className="btn-secondary">Save facts</SubmitButton></div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Lead score">
            <div className="mb-3"><ScoreBar score={site.score} /></div>
            <ul className="space-y-1 text-sm">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`w-8 shrink-0 text-right tabular-nums ${r.points >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {r.points >= 0 ? "+" : ""}{r.points}
                  </span>
                  <span>{r.reason}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Deals">
            {site.deals.length === 0 ? (
              <Empty>Not in the pipeline yet.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {site.deals.map((d) => (
                  <li key={d.id}>
                    <Link className="link" href={`/deals/${d.id}`}>{usd(d.value)}</Link>{" "}
                    <Badge tone={STAGE_TONE[d.stage]}>{DEAL_STAGE_LABEL[d.stage as DealStage]}</Badge>
                    <span className="text-xs text-stone-500"> · {fmtDate(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Signals">
            {site.signals.length === 0 ? (
              <p className="text-sm text-stone-500">None yet.</p>
            ) : (
              <ul className="mb-4 space-y-2 text-sm">
                {site.signals.map((sg) => (
                  <li key={sg.id}>
                    <Badge tone="amber">{SIGNAL_LABEL[sg.type] ?? sg.type}</Badge> {sg.title}
                    {sg.detail && <div className="text-xs text-stone-500">{sg.detail}</div>}
                    <div className="text-xs text-stone-400">{fmtDate(sg.detectedAt)}</div>
                  </li>
                ))}
              </ul>
            )}
            <form action={addSignal.bind(null, site.id)} className="space-y-2">
              <select className="input" name="type" defaultValue="HEARING_NOTICE">
                <option value="HEARING_NOTICE">Zoning hearing notice</option>
                <option value="EXPANSION">Expansion</option>
                <option value="OWNERSHIP_CHANGE">Ownership change</option>
                <option value="MANUAL">Note</option>
              </select>
              <input className="input" name="title" placeholder="e.g. CUP hearing Oct 14, Town of Vienna" required />
              <input className="input" name="detail" placeholder="Details / source link" />
              <SubmitButton className="btn-secondary w-full">Add signal</SubmitButton>
            </form>
          </Card>

          {site.company && site.company.sites.length > 1 && (
            <Card title={`Other ${site.company.name} sites`}>
              <ul className="space-y-1 text-sm">
                {site.company.sites.filter((x) => x.id !== site.id).map((x) => (
                  <li key={x.id} className="flex justify-between">
                    <Link className="link" href={`/sites/${x.id}`}>{x.name}</Link>
                    <span className="text-xs text-stone-500">{x.county}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
