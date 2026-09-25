import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { apolloEnabled } from "@/lib/apollo";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { enrichNow, importCsv, rescoreNow, syncMshaNow, syncWdnrNow } from "../../actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function last(job: string) {
  return db.jobRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" } });
}

function LastRun({ run }: { run: Awaited<ReturnType<typeof last>> }) {
  if (!run) return <p className="text-xs text-slate-400">Never run.</p>;
  return (
    <p className={`text-xs ${run.ok ? "text-slate-500" : "text-red-700"}`}>
      Last run {fmtDateTime(run.startedAt)}: {run.summary}
    </p>
  );
}

export default async function ImportPage() {
  const [msha, wdnr, csv, enrich, counts] = await Promise.all([
    last("msha"),
    last("wdnr"),
    last("csv-import"),
    last("enrich"),
    Promise.all([db.site.count(), db.company.count(), db.contact.count(), db.signal.count()]),
  ]);
  return (
    <>
      <PageHeader
        title="Data"
        subtitle={`${counts[0].toLocaleString()} sites · ${counts[1].toLocaleString()} operators · ${counts[2].toLocaleString()} contacts · ${counts[3].toLocaleString()} signals`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="1 · MSHA mine registry (every WI pit & quarry)">
          <p className="mb-3 text-sm text-slate-600">
            Downloads MSHA&apos;s open Mines dataset and loads every Wisconsin sand &amp; gravel, stone and industrial sand operation
            with operator, status, county and coordinates. Weekly re-syncs detect <strong>new mines</strong>, <strong>ownership changes</strong> and{" "}
            <strong>reactivations</strong> automatically (cron: Mondays).
          </p>
          <form action={syncMshaNow} className="mb-2">
            <SubmitButton pendingText="Downloading & importing (1–3 min)…">Sync MSHA now</SubmitButton>
          </form>
          <LastRun run={msha} />
          <p className="mt-2 text-xs text-slate-500">
            If the download is blocked from the server, run <code>npm run msha:sync -- --file Mines.zip</code> locally against the production DATABASE_URL.
          </p>
        </Card>

        <Card title="2 · WDNR permit applications (buying signal)">
          <p className="mb-3 text-sm text-slate-600">
            Pulls pending WPDES nonmetallic-mining general permit applications from WDNR&apos;s public map service and attaches each to the
            nearest known site. Someone filing for coverage is permitting right now.
          </p>
          <form action={syncWdnrNow} className="mb-2">
            <SubmitButton pendingText="Querying WDNR…">Sync WDNR now</SubmitButton>
          </form>
          <LastRun run={wdnr} />
        </Card>

        <Card title="3 · Contacts CSV (Apollo / Apify / any export)">
          <p className="mb-3 text-sm text-slate-600">
            Columns are detected automatically (first_name, last_name, email, company_name, company_domain, job_title, phone…). Companies
            are matched to MSHA operators by domain or name; scores update immediately.
          </p>
          <form action={importCsv} className="mb-2 flex flex-wrap items-center gap-2">
            <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
            <SubmitButton pendingText="Importing…">Import</SubmitButton>
          </form>
          <LastRun run={csv} />
        </Card>

        <Card title="4 · Apollo enrichment (find the owner)">
          <p className="mb-3 text-sm text-slate-600">
            For the highest-scoring operators without an email, looks up the company and its owner / president / GM in Apollo. Email reveals
            cost Apollo credits and are capped per day in Settings. Runs daily when autopilot is on.
          </p>
          {apolloEnabled() ? (
            <form action={enrichNow} className="mb-2">
              <SubmitButton pendingText="Enriching…">Enrich top 15 now</SubmitButton>
            </form>
          ) : (
            <p className="mb-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">Set APOLLO_API_KEY to enable.</p>
          )}
          <LastRun run={enrich} />
        </Card>

        <Card title="Re-score">
          <p className="mb-3 text-sm text-slate-600">Scores update on every sync and import; run this after editing scoring rules.</p>
          <form action={rescoreNow}>
            <SubmitButton className="btn-secondary">Re-score all sites</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
