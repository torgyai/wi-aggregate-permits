import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { DEAL_STAGES, DEAL_STAGE_LABEL } from "@/lib/enums";
import { fmtDate, fullName, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const deals = await db.deal.findMany({
    where: { OR: [{ stage: { notIn: ["LOST", "WON"] } }, { updatedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }] },
    include: {
      company: true,
      site: { select: { name: true, county: true } },
      events: { orderBy: { createdAt: "desc" }, take: 1 },
      proposal: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const contacts = new Map(
    (await db.contact.findMany({ where: { id: { in: deals.map((d) => d.primaryContactId).filter((x): x is string => !!x) } } })).map((c) => [c.id, c]),
  );
  const byStage = Object.fromEntries(DEAL_STAGES.map((st) => [st, deals.filter((d) => d.stage === st)]));

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Every operator in play. Stages move automatically on sends, replies, proposal views and signatures." />
      <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
        {DEAL_STAGES.map((st) => {
          const list = byStage[st];
          const total = list.reduce((a, d) => a + d.value, 0);
          return (
            <div key={st} className="flex min-h-[200px] flex-col rounded-lg bg-stone-100 p-2">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className="text-sm font-semibold">{DEAL_STAGE_LABEL[st]}</span>
                <span className="text-xs text-stone-500">{list.length} · {usd(total)}</span>
              </div>
              <div className="space-y-2">
                {list.map((d) => {
                  const c = d.primaryContactId ? contacts.get(d.primaryContactId) : null;
                  return (
                    <Link key={d.id} href={`/deals/${d.id}`} className="block rounded-md border border-stone-200 bg-white p-2.5 text-sm shadow-sm hover:border-amber-400">
                      <div className="font-medium">{d.company.name}</div>
                      <div className="text-xs text-stone-500">{d.site ? `${d.site.name} · ${d.site.county ?? ""}` : "—"}</div>
                      {c && <div className="mt-1 text-xs">{fullName(c)}</div>}
                      <div className="mt-1.5 flex items-center justify-between text-xs text-stone-500">
                        <span>{d.events[0]?.type.toLowerCase().replace(/_/g, " ") ?? ""}</span>
                        <span>{fmtDate(d.updatedAt)}</span>
                      </div>
                      {d.proposal && <div className="mt-1"><Badge tone="amber">proposal {d.proposal.status.toLowerCase()}</Badge></div>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
