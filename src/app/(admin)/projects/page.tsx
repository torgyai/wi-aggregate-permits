import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { fmtDate, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({
    include: {
      deal: { include: { company: true, site: true } },
      permits: { select: { status: true } },
      obligations: { where: { status: { in: ["UPCOMING", "OVERDUE"] } }, orderBy: { dueAt: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Projects" subtitle="Signed engagements: intake → drafts → filing → approval → compliance." />
      <Card>
        {projects.length === 0 ? (
          <Empty>No signed projects yet. They appear here the moment a client accepts a proposal.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Client</th><th>Site</th><th>Status</th><th>Permits</th><th>Next obligation</th><th>Value</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const live = p.permits.filter((x) => x.status !== "NOT_REQUIRED");
                const approved = live.filter((x) => x.status === "APPROVED").length;
                return (
                  <tr key={p.id}>
                    <td><Link className="link font-medium" href={`/projects/${p.id}`}>{p.deal.company.name}</Link></td>
                    <td>{p.deal.site?.name ?? "—"}<div className="text-xs text-stone-500">{p.deal.site?.county}</div></td>
                    <td><Badge tone={p.status === "INTAKE" ? "amber" : p.status === "COMPLIANCE" ? "green" : "blue"}>{p.status.toLowerCase().replace("_", " ")}</Badge></td>
                    <td>{approved}/{live.length} approved</td>
                    <td className="text-sm">{p.obligations[0] ? <>{p.obligations[0].title}<div className="text-xs text-stone-500">{fmtDate(p.obligations[0].dueAt)}</div></> : "—"}</td>
                    <td>{usd(p.deal.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
