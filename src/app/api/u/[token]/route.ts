import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/outreach/replies";
import { readUnsubscribeToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) lands here via POST. */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const email = readUnsubscribeToken(params.token);
  if (!email) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await unsubscribe(email, "one-click");
  return NextResponse.json({ ok: true });
}
