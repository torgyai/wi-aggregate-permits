/**
 * Inbound replies: match -> classify -> act. The autopilot answers the easy
 * cases itself (book a call, send the proposal, acknowledge "not now", honor
 * unsubscribes) and queues anything uncertain for a one-click human approval.
 */
import { z } from "zod";
import { AiUnavailable, generateJson } from "../ai";
import { db } from "../db";
import { usd } from "../format";
import { createProposal, sendProposal } from "../proposals";
import { getSettings, type Settings } from "../settings";
import { classifyReply, stripQuoted, type Classification } from "./classify";
import { buildLeadContext, type LeadContext } from "./context";
import { logDealEvent, stopEnrollments } from "./engine";
import { composeBody, sendMail } from "./mailer";

export type InboundEmail = {
  from: string;
  fromName?: string;
  to?: string;
  subject: string;
  text: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  date?: Date;
};

const emailOf = (s: string) => (/[\w.+-]+@[\w-]+\.[\w.-]+/.exec(s)?.[0] ?? s).toLowerCase();

export async function notifyOwner(subject: string, text: string, s?: Settings) {
  const settings = s ?? (await getSettings());
  const to = settings.notifyEmail || settings.fromEmail;
  if (!to) return;
  try {
    await sendMail({ from: settings.fromEmail || to, fromName: `${settings.companyName} autopilot`, to, subject, text });
  } catch (err) {
    console.error("notifyOwner failed:", err);
  }
}

export async function ingestInbound(mail: InboundEmail): Promise<{ status: string; messageId?: string; classification?: string }> {
  const settings = await getSettings();
  if (mail.messageId) {
    const dup = await db.message.findUnique({ where: { providerId: mail.messageId } });
    if (dup) return { status: "duplicate", messageId: dup.id };
  }
  const from = emailOf(mail.from);
  const fresh = stripQuoted(mail.text);

  // Which conversation is this? Thread headers first, then sender address.
  const refs = [mail.inReplyTo, ...(mail.references ?? [])].filter((x): x is string => !!x);
  const original = refs.length
    ? await db.message.findFirst({ where: { providerId: { in: refs } }, orderBy: { createdAt: "desc" } })
    : null;
  let contact = original?.contactId ? await db.contact.findUnique({ where: { id: original.contactId } }) : null;
  contact ??= await db.contact.findUnique({ where: { email: from } });

  // Bounces come from the mail system, not the contact: find who bounced in the body.
  const isBounceSender = /mailer-daemon|postmaster|mail delivery/i.test(`${mail.from} ${mail.fromName ?? ""}`);
  if (isBounceSender && !original) {
    const emails = Array.from(new Set((mail.text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []).map((e) => e.toLowerCase())));
    contact = emails.length ? await db.contact.findFirst({ where: { email: { in: emails } } }) : null;
  }

  const deal = contact
    ? await db.deal.findFirst({
        where: { companyId: contact.companyId, stage: { notIn: ["WON", "LOST"] } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const cls = await classifyReply(mail.subject, fresh || mail.text, mail.from);
  const inbound = await db.message.create({
    data: {
      direction: "IN",
      contactId: contact?.id,
      dealId: deal?.id ?? original?.dealId,
      enrollmentId: original?.enrollmentId,
      fromEmail: from,
      toEmail: mail.to ? emailOf(mail.to) : null,
      subject: mail.subject,
      body: fresh || mail.text,
      status: "RECEIVED",
      providerId: mail.messageId,
      inReplyTo: mail.inReplyTo,
      classification: cls.classification,
      confidence: cls.confidence,
      aiSummary: cls.summary,
      generatedBy: cls.by,
      createdAt: mail.date,
    },
  });
  if (!contact) return { status: "unmatched", messageId: inbound.id, classification: cls.classification };

  await act(inbound.id, contact.id, deal?.id ?? null, cls, mail, settings);
  await db.message.update({ where: { id: inbound.id }, data: { handled: true } });
  return { status: "handled", messageId: inbound.id, classification: cls.classification };
}

async function setStage(dealId: string | null, stage: string, detail: string, extra: Record<string, unknown> = {}) {
  if (!dealId) return;
  const d = await db.deal.findUnique({ where: { id: dealId } });
  if (!d || d.stage === stage || d.stage === "WON") return;
  const order = ["NEW", "CONTACTED", "ENGAGED", "MEETING", "PROPOSAL"];
  // Only move forward (or to LOST).
  if (stage !== "LOST" && order.indexOf(stage) <= order.indexOf(d.stage)) return;
  await db.deal.update({ where: { id: dealId }, data: { stage, ...extra } });
  await logDealEvent(dealId, "STAGE", `${d.stage} → ${stage}: ${detail}`);
}

async function act(
  inboundId: string,
  contactId: string,
  dealId: string | null,
  cls: Classification & { by: string },
  mail: InboundEmail,
  s: Settings,
) {
  const contact = await db.contact.findUniqueOrThrow({ where: { id: contactId }, include: { company: true } });
  const who = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || contact.email!;
  await logDealEvent(dealId, "REPLY", `${cls.classification}: ${cls.summary}`);

  switch (cls.classification) {
    case "BOUNCE": {
      await db.contact.update({ where: { id: contactId }, data: { emailStatus: "BOUNCED" } });
      await db.suppression.upsert({ where: { email: contact.email! }, create: { email: contact.email!, reason: "bounce" }, update: {} });
      await stopEnrollments(contactId, "BOUNCED", "hard bounce");
      return;
    }
    case "UNSUBSCRIBE": {
      await unsubscribe(contact.email!, "reply");
      await setStage(dealId, "LOST", "asked to be removed", { lostReason: "Unsubscribed" });
      return;
    }
    case "OUT_OF_OFFICE": {
      // Not a real reply: resume the sequence after they're back.
      const back = cls.returnDate ? new Date(cls.returnDate) : null;
      const resume = back && !isNaN(back.getTime()) && back > new Date() ? new Date(back.getTime() + 86_400_000) : new Date(Date.now() + 7 * 86_400_000);
      await db.enrollment.updateMany({ where: { contactId, status: "ACTIVE" }, data: { nextRunAt: resume } });
      return;
    }
    case "NOT_INTERESTED": {
      await stopEnrollments(contactId, "REPLIED", "not interested");
      await setStage(dealId, "LOST", cls.summary, { lostReason: cls.summary });
      return;
    }
    default:
      break;
  }

  // A human replied: stop automated follow-ups for this contact.
  await stopEnrollments(contactId, "REPLIED", cls.classification.toLowerCase());
  const ctx = await buildLeadContext(contactId, null, s).catch(() => null);

  if (cls.classification === "NOT_NOW") {
    const days = cls.followUpDays ?? 120;
    await db.task.create({
      data: {
        type: "FOLLOW_UP",
        title: `Re-engage ${who} (${contact.company.name})`,
        detail: `They said: ${cls.summary}`,
        contactId,
        dealId,
        dueAt: new Date(Date.now() + days * 86_400_000),
      },
    });
    await reply(inboundId, contactId, dealId, mail, ctx, cls, s, { followUpDays: days });
    return;
  }

  if (cls.classification === "REFERRAL" && cls.referralEmail) {
    const email = cls.referralEmail.toLowerCase();
    const [first, ...rest] = (cls.referralName ?? "").split(" ");
    const suppressed = await db.suppression.findUnique({ where: { email } });
    if (!suppressed) {
      await db.contact.upsert({
        where: { email },
        create: { companyId: contact.companyId, email, firstName: first || null, lastName: rest.join(" ") || null, source: "REFERRAL" },
        update: {},
      });
    }
    await reply(inboundId, contactId, dealId, mail, ctx, cls, s);
    return;
  }

  if (cls.classification === "PROPOSAL_REQUEST" && dealId && s.autoSendProposalOnRequest) {
    await setStage(dealId, "ENGAGED", cls.summary);
    const proposal = await createProposal(dealId);
    await sendProposal(proposal.id, { viaReplyTo: { inboundId, subject: mail.subject, inReplyTo: mail.messageId } });
    await notifyOwner(
      `Proposal sent: ${contact.company.name}`,
      `${who} asked for pricing ("${cls.summary}"). The autopilot sent the ${usd(s.packagePrice)} proposal.\n\nDeal: ${process.env.APP_URL ?? ""}/deals/${dealId}`,
      s,
    );
    return;
  }

  if (cls.classification === "INTERESTED" || cls.classification === "MEETING_REQUEST" || cls.classification === "PROPOSAL_REQUEST") {
    await setStage(dealId, "ENGAGED", cls.summary);
    await db.task.create({
      data: {
        type: "MEETING",
        title: `Book call with ${who} (${contact.company.name})`,
        detail: cls.summary,
        contactId,
        dealId,
        dueAt: new Date(),
      },
    });
    await notifyOwner(
      `🔥 ${contact.company.name} replied: ${cls.classification.replace("_", " ").toLowerCase()}`,
      `${who} <${contact.email}>\n\n${cls.summary}\n\n---\n${mail.text.slice(0, 1500)}`,
      s,
    );
  }
  await reply(inboundId, contactId, dealId, mail, ctx, cls, s);
}

// ---------------------------------------------------------------- reply drafting

const ReplySchema = z.object({ body: z.string().min(10).max(2000) });
const REPLY_JSON = {
  type: "object",
  properties: { body: { type: "string", description: "Plain-text reply starting with 'Hi <first name>,'. No signature." } },
  required: ["body"],
  additionalProperties: false,
};

const REPLY_SYSTEM = `You reply, as the sender, to a prospect who answered a cold email from a Wisconsin permitting firm (sand & gravel pits and quarries: NR 135 reclamation permits, conditional use permits, WPDES coverage, air permits for crushers, high-capacity wells, SPCC, MSHA filings).

Rules:
- Under 120 words, plain text, warm and direct. No signature (appended automatically).
- Use only facts given. Never guarantee approvals or timelines; say "typically".
- Don't give legal advice. If a question needs site details you don't have, say you'll cover it on a short call.
- If a booking link is given and the goal is a call, include it once on its own line.
- If a proposal link is given, include it once on its own line.
- For NOT_NOW: acknowledge, say when you'll check back (month), no pitch.
- For REFERRAL: thank them; say you'll reach out to the person they named.
- Never mention AI or automation.`;

function fallbackReply(cls: Classification, ctx: LeadContext | null, s: Settings, followUpDays?: number): string {
  const name = ctx?.contact.firstName || "there";
  const site = ctx?.site?.name ?? "your site";
  const book = s.bookingUrl ? `\n\nHere's my calendar if it's easier to grab a time:\n${s.bookingUrl}` : "";
  switch (cls.classification) {
    case "NOT_NOW": {
      const when = new Date(Date.now() + (followUpDays ?? 120) * 86_400_000).toLocaleString("en-US", {
        month: "long",
        timeZone: "America/Chicago",
      });
      return `Hi ${name},\n\nUnderstood, thanks for letting me know. I'll check back in ${when}. If anything changes with ${site} before then, just reply here.`;
    }
    case "REFERRAL":
      return `Hi ${name},\n\nThanks for pointing me in the right direction. I'll reach out to them directly.`;
    case "QUESTION":
      return `Hi ${name},\n\nGood question. The honest answer depends on a few details about ${site} (acreage, whether you dewater or wash, and what's crushed on site). Easiest is a 15-minute call where I can answer it properly.${book}`;
    default:
      return `Hi ${name},\n\nGreat. A 15-minute call is enough to walk through what the county and WDNR will want for ${site} and whether the package fits.${book || "\n\nWhat day and time works for you this week or next?"}`;
  }
}

async function draftReply(cls: Classification, ctx: LeadContext | null, inbound: string, s: Settings, followUpDays?: number) {
  try {
    const out = await generateJson({
      system: REPLY_SYSTEM,
      prompt: JSON.stringify({
        their_reply: inbound.slice(0, 4000),
        classification: cls.classification,
        summary: cls.summary,
        follow_up_in_days: followUpDays ?? null,
        lead: ctx
          ? {
              first_name: ctx.contact.firstName,
              company: ctx.company.name,
              site: ctx.site,
              likely_permits: ctx.needs.slice(0, 6).map((n) => ({ permit: n.shortName, status: n.status, why: n.reason })),
              typical_timeline_weeks: ctx.timelineWeeks,
            }
          : null,
        offer: {
          name: s.packageName,
          price: usd(s.packagePrice),
          deposit_pct: s.depositPct,
          includes:
            "drafted applications and plans, county/WDNR correspondence through approval, reclamation cost estimate for the bond, SWPPP, hearing prep, 12-month compliance calendar; third-party studies and agency fees are pass-through",
        },
        booking_url: s.bookingUrl || null,
        sender_first_name: s.senderName,
      }),
      schema: ReplySchema,
      jsonSchema: REPLY_JSON,
      effort: "medium",
      maxTokens: 3000,
    });
    return { body: out.body.trim(), by: "ai" as const };
  } catch (err) {
    if (!(err instanceof AiUnavailable)) console.error("AI reply failed, using template:", err);
    return { body: fallbackReply(cls, ctx, s, followUpDays), by: "template" as const };
  }
}

async function reply(
  inboundId: string,
  contactId: string,
  dealId: string | null,
  mail: InboundEmail,
  ctx: LeadContext | null,
  cls: Classification,
  s: Settings,
  opts: { followUpDays?: number } = {},
) {
  if (cls.classification === "OTHER") {
    await db.task.create({
      data: { type: "REVIEW_REPLY", title: "Review unclassified reply", detail: cls.summary, contactId, dealId, messageId: inboundId },
    });
    return;
  }
  const draft = await draftReply(cls, ctx, mail.text, s, opts.followUpDays);
  const autoSend =
    s.replyMode === "autopilot" &&
    cls.confidence >= s.replyAutoSendConfidence &&
    ["INTERESTED", "MEETING_REQUEST", "NOT_NOW", "REFERRAL"].includes(cls.classification);

  const lastOut = await db.message.findFirst({
    where: { contactId, direction: "OUT", status: "SENT" },
    orderBy: { createdAt: "desc" },
  });
  const pending = await db.message.create({
    data: {
      direction: "OUT",
      contactId,
      dealId,
      fromEmail: lastOut?.fromEmail ?? (s.fromEmail || null),
      toEmail: emailOf(mail.from),
      subject: `Re: ${mail.subject.replace(/^Re:\s*/i, "")}`,
      body: draft.body,
      status: "PENDING_APPROVAL",
      inReplyTo: mail.messageId,
      generatedBy: draft.by,
    },
  });
  if (autoSend) {
    await sendPending(pending.id);
  } else {
    await db.task.create({
      data: {
        type: "REVIEW_REPLY",
        title: `Approve reply to ${ctx?.contact.firstName ?? mail.from} (${cls.classification.toLowerCase()})`,
        detail: cls.summary,
        contactId,
        dealId,
        messageId: pending.id,
      },
    });
  }
}

/** Send a drafted reply (after approval, or automatically). */
export async function sendPending(messageId: string, editedBody?: string) {
  const s = await getSettings();
  const m = await db.message.findUniqueOrThrow({ where: { id: messageId } });
  if (m.status !== "PENDING_APPROVAL" && m.status !== "FAILED") throw new Error(`Message is ${m.status}`);
  const body = (editedBody ?? m.body).trim();
  const text = composeBody(body, s, m.toEmail!, { withFooter: false });
  try {
    const res = await sendMail(
      {
        from: m.fromEmail || s.fromEmail,
        fromName: s.senderName,
        to: m.toEmail!,
        subject: m.subject ?? "Re:",
        text,
        replyTo: s.replyToEmail || undefined,
        inReplyTo: m.inReplyTo,
        references: m.inReplyTo ? [m.inReplyTo] : undefined,
      },
      m.fromEmail ?? undefined,
    );
    await db.message.update({
      where: { id: messageId },
      data: { status: "SENT", body: text, providerId: res.messageId, fromEmail: res.mailbox, sentAt: new Date() },
    });
    await db.task.updateMany({ where: { messageId, status: "OPEN" }, data: { status: "DONE", completedAt: new Date() } });
    await logDealEvent(m.dealId, "REPLY_SENT", body.slice(0, 200));
  } catch (err) {
    await db.message.update({
      where: { id: messageId },
      data: { status: "FAILED", error: (err instanceof Error ? err.message : String(err)).slice(0, 500) },
    });
    throw err;
  }
}

export async function unsubscribe(email: string, reason: string) {
  const e = email.toLowerCase();
  await db.suppression.upsert({ where: { email: e }, create: { email: e, reason }, update: {} });
  const contact = await db.contact.findUnique({ where: { email: e } });
  if (contact) {
    await db.contact.update({ where: { id: contact.id }, data: { doNotContact: true } });
    await stopEnrollments(contact.id, "UNSUBSCRIBED", reason);
  }
}
