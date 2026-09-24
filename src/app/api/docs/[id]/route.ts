import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Download a generated permit draft as Markdown (admin only — gated by middleware). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const doc = await db.generatedDoc.findUnique({ where: { id: params.id } });
  if (!doc) return new Response("Not found", { status: 404 });
  const name = doc.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new Response(doc.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-v${doc.version}.md"`,
    },
  });
}
