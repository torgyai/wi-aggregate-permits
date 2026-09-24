import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestInbound } from "@/lib/outreach/replies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const given = Buffer.from(req.headers.get("x-inbound-secret") ?? url.searchParams.get("secret") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

const header = (headers: unknown, name: string): string | undefined => {
  if (Array.isArray(headers)) {
    const h = headers.find((x: { Name?: string; name?: string }) => (x.Name ?? x.name ?? "").toLowerCase() === name);
    return h?.Value ?? h?.value;
  }
  if (headers && typeof headers === "object") return (headers as Record<string, string>)[name];
  return undefined;
};

/**
 * Inbound email webhook. Accepts a normalized JSON body
 *   { from, subject, text, messageId?, inReplyTo?, references? }
 * or Postmark's inbound format (From, Subject, TextBody, MessageID, Headers[]).
 * Auth: `x-inbound-secret` header or `?secret=` (INBOUND_SECRET).
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json()) as Record<string, unknown>;
  const refs = String(b.references ?? header(b.Headers, "references") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const result = await ingestInbound({
    from: String(b.from ?? b.From ?? ""),
    fromName: (b.fromName ?? b.FromName) as string | undefined,
    to: (b.to ?? b.To) as string | undefined,
    subject: String(b.subject ?? b.Subject ?? ""),
    text: String(b.text ?? b.TextBody ?? b.StrippedTextReply ?? ""),
    messageId: (b.messageId ?? header(b.Headers, "message-id") ?? (b.MessageID ? `<${b.MessageID}>` : undefined)) as string | undefined,
    inReplyTo: (b.inReplyTo ?? header(b.Headers, "in-reply-to")) as string | undefined,
    references: Array.isArray(b.references) ? (b.references as string[]) : refs,
    date: b.date ? new Date(String(b.date)) : undefined,
  });
  return NextResponse.json(result);
}
