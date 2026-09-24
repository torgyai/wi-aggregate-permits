/**
 * Poll the reply inbox over IMAP (Google Workspace / Outlook app passwords work).
 * Read-only: tracks the last seen UID instead of marking mail as read.
 */
import { db } from "../db";
import { ingestInbound } from "./replies";

export const imapEnabled = () => !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS);

const KEY = "imap:lastUid";

export async function pollImap(max = 50): Promise<{ summary: string; fetched: number; handled: number }> {
  if (!imapEnabled()) return { summary: "IMAP not configured.", fetched: 0, handled: 0 };
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASS! },
    logger: false,
  });
  const row = await db.setting.findUnique({ where: { key: KEY } });
  let lastUid = Number(row?.value ?? 0);
  let fetched = 0;
  let handled = 0;
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    if (!lastUid) {
      // First run: start from now, don't replay the whole inbox.
      const status = await client.status("INBOX", { uidNext: true });
      lastUid = Math.max(0, (status.uidNext ?? 1) - 1);
    } else {
      for await (const msg of client.fetch(`${lastUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (msg.uid <= lastUid || !msg.source) continue;
        fetched++;
        const parsed = await simpleParser(msg.source);
        const from = parsed.from?.value?.[0];
        const refs = parsed.references;
        const res = await ingestInbound({
          from: from?.address ?? "",
          fromName: from?.name,
          to: Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to?.text,
          subject: parsed.subject ?? "",
          text: parsed.text ?? "",
          messageId: parsed.messageId,
          inReplyTo: parsed.inReplyTo,
          references: Array.isArray(refs) ? refs : refs ? [refs] : [],
          date: parsed.date,
        }).catch((err) => {
          console.error("ingest failed", err);
          return null;
        });
        if (res?.status === "handled") handled++;
        lastUid = Math.max(lastUid, msg.uid);
        if (fetched >= max) break;
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: String(lastUid) }, update: { value: String(lastUid) } });
  return { summary: `IMAP: ${fetched} new messages, ${handled} matched to leads.`, fetched, handled };
}
