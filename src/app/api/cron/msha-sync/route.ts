import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runJob } from "@/lib/jobs";
import { syncMsha } from "@/lib/prospecting";
import { syncWdnrApplications } from "@/lib/wdnr";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Weekly: refresh the MSHA registry (new mines, owner changes) and WDNR permit applications. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const out: Record<string, string> = {};
  const jobs: [string, () => Promise<{ summary: string }>][] = [
    ["msha", () => syncMsha()],
    ["wdnr", () => syncWdnrApplications()],
  ];
  for (const [name, fn] of jobs) {
    try {
      out[name] = (await runJob(name, fn)).summary;
    } catch (err) {
      out[name] = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return NextResponse.json(out);
}
