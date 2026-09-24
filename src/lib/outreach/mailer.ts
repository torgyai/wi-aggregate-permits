/**
 * Outbound mail. Transports:
 *  - log    : records the message as sent without sending (safe default / dry run)
 *  - smtp   : any mailbox (Google Workspace, Outlook); several mailboxes rotate
 *  - resend : Resend HTTP API
 *
 * Every commercial email carries the sender's physical address and a working
 * unsubscribe link + List-Unsubscribe headers (CAN-SPAM, and Gmail/Yahoo bulk
 * sender requirements).
 */
import { randomUUID } from "node:crypto";
import type { Settings } from "../settings";
import { appUrl } from "../settings";
import { unsubscribeToken } from "../tokens";

export type Mailbox = { user: string; pass: string; host: string; port: number };

export function mailboxes(): Mailbox[] {
  const list = (process.env.SMTP_MAILBOXES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      // user:pass@host:port — the password may itself contain ':' or '@', so split from the right.
      const at = entry.lastIndexOf("@");
      const creds = entry.slice(0, at);
      const [host, port] = entry.slice(at + 1).split(":");
      const colon = creds.indexOf(":");
      return { user: creds.slice(0, colon), pass: creds.slice(colon + 1), host, port: Number(port || 587) };
    })
    .filter((m) => m.user && m.host);
  if (list.length) return list;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return [
      {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS ?? "",
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
      },
    ];
  }
  return [];
}

export const transportName = () => (process.env.MAIL_TRANSPORT ?? "log").toLowerCase();

/** Human link (confirm page). */
export function unsubscribeUrl(email: string) {
  return `${appUrl()}/u/${unsubscribeToken(email)}`;
}

/** RFC 8058 one-click endpoint for the List-Unsubscribe header (mail clients POST here). */
export function oneClickUnsubscribeUrl(email: string) {
  return `${appUrl()}/api/u/${unsubscribeToken(email)}`;
}

export function signature(s: Settings) {
  return [s.senderName, [s.senderTitle, s.companyName].filter(Boolean).join(", "), s.phone].filter(Boolean).join("\n");
}

export function footer(s: Settings, email: string) {
  return [
    "--",
    `${s.companyName}${s.physicalAddress ? ` · ${s.physicalAddress}` : ""}`,
    `Not relevant? Unsubscribe: ${unsubscribeUrl(email)}`,
  ].join("\n");
}

export function composeBody(body: string, s: Settings, to: string, opts: { withFooter?: boolean } = {}) {
  const parts = [body.trim(), signature(s)];
  if (opts.withFooter !== false) parts.push(footer(s, to));
  return parts.join("\n\n");
}

export type OutgoingMail = {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  inReplyTo?: string | null;
  references?: string[];
  /** Include List-Unsubscribe headers (cold outreach). */
  bulk?: boolean;
};

export type SendResult = { messageId: string; transport: string; mailbox: string };

let rr = 0;

export async function sendMail(mail: OutgoingMail, preferredMailbox?: string): Promise<SendResult> {
  const t = transportName();
  const messageId = `<${randomUUID()}@${(mail.from.split("@")[1] || "stratex.local").trim()}>`;
  const headers: Record<string, string> = {};
  if (mail.bulk) {
    headers["List-Unsubscribe"] = `<${oneClickUnsubscribeUrl(mail.to)}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  if (t === "log") {
    console.log(`[mail:log] ${mail.from} -> ${mail.to} | ${mail.subject}`);
    return { messageId, transport: "log", mailbox: mail.from };
  }

  if (t === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${mail.fromName} <${mail.from}>`,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        reply_to: mail.replyTo,
        headers: {
          ...headers,
          "Message-ID": messageId,
          ...(mail.inReplyTo ? { "In-Reply-To": mail.inReplyTo, References: (mail.references ?? [mail.inReplyTo]).join(" ") } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { messageId, transport: "resend", mailbox: mail.from };
  }

  if (t === "smtp") {
    const boxes = mailboxes();
    if (!boxes.length) throw new Error("MAIL_TRANSPORT=smtp but no SMTP mailbox configured");
    const box = boxes.find((b) => b.user === preferredMailbox) ?? boxes[rr++ % boxes.length];
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: box.host,
      port: box.port,
      secure: box.port === 465,
      auth: { user: box.user, pass: box.pass },
    });
    await transporter.sendMail({
      from: { name: mail.fromName, address: box.user },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      replyTo: mail.replyTo,
      messageId,
      inReplyTo: mail.inReplyTo ?? undefined,
      references: mail.references,
      headers,
    });
    return { messageId, transport: "smtp", mailbox: box.user };
  }

  throw new Error(`Unknown MAIL_TRANSPORT: ${t}`);
}
