import { db } from "../db";
import { titleRank } from "../apollo";
import { getSettings, type Settings } from "../settings";
import { buildLeadContext } from "./context";
import { composeBody, mailboxes, sendMail, transportName } from "./mailer";
import { writeEmail } from "./personalize";
import { DEFAULT_SEQUENCE_KEY, getSequence } from "./sequence";
import { taskText } from "./templates";
import { chicagoTime, inWindow, localParts, nextSendTime, scheduleAfter } from "./window";

const OPEN_STAGES = ["NEW", "CONTACTED", "ENGAGED", "MEETING", "PROPOSAL"];

export function startOfChicagoDay(now: Date) {
  const p = localParts(now);
  return chicagoTime(p.year, p.month, p.day, 0);
}

export async function logDealEvent(dealId: string | null | undefined, type: string, detail?: string) {
  if (dealId) await db.dealEvent.create({ data: { dealId, type, detail } });
}

/**
 * Pick today's best new leads and start them on the sequence: one decision maker
 * per operator, highest-scoring site first, never anyone suppressed or already worked.
 */
export async function enrollNewLeads(now = new Date(), settings?: Settings) {
  const s = settings ?? (await getSettings());
  const today = startOfChicagoDay(now);
  const startedToday = await db.enrollment.count({ where: { startedAt: { gte: today } } });
  let remaining = Math.max(0, s.dailyNewEnrollments - startedToday);
  if (!remaining) return { summary: "Enrollment: daily cap reached.", enrolled: 0 };

  const suppressed = new Set((await db.suppression.findMany({ select: { email: true } })).map((x) => x.email));
  const sites = await db.site.findMany({
    where: {
      score: { gte: s.minScoreToEnroll },
      companyId: { not: null },
      company: {
        isLargeNational: false,
        contacts: { some: { email: { not: null }, doNotContact: false } },
        deals: { none: { stage: { in: [...OPEN_STAGES, "WON"] } } },
      },
    },
    orderBy: { score: "desc" },
    take: remaining * 4,
    include: {
      company: {
        include: {
          contacts: { where: { email: { not: null }, doNotContact: false }, include: { enrollments: true } },
        },
      },
    },
  });

  const seenCompanies = new Set<string>();
  let enrolled = 0;
  for (const site of sites) {
    if (!remaining) break;
    const company = site.company!;
    if (seenCompanies.has(company.id)) continue;
    seenCompanies.add(company.id);
    // Anyone at this company already sequenced? Then leave them be.
    if (company.contacts.some((c) => c.enrollments.length)) continue;
    const contact = company.contacts
      .filter((c) => c.email && !suppressed.has(c.email) && c.emailStatus !== "BOUNCED" && c.emailStatus !== "INVALID")
      .sort((a, b) => titleRank(a.title) - titleRank(b.title))[0];
    if (!contact) continue;

    const deal = await db.deal.create({
      data: {
        companyId: company.id,
        siteId: site.id,
        primaryContactId: contact.id,
        stage: "NEW",
        value: s.packagePrice,
        source: "OUTBOUND",
      },
    });
    await db.enrollment.create({
      data: {
        contactId: contact.id,
        siteId: site.id,
        dealId: deal.id,
        sequenceKey: DEFAULT_SEQUENCE_KEY,
        nextRunAt: nextSendTime(now, s),
      },
    });
    await logDealEvent(deal.id, "ENROLLED", `Score ${site.score}: ${contact.email} for ${site.name}`);
    enrolled++;
    remaining--;
  }
  return { summary: `Enrollment: ${enrolled} new leads started.`, enrolled };
}

/** Sender mailboxes with today's remaining capacity. */
async function mailboxCapacity(s: Settings, now: Date): Promise<Map<string, number>> {
  const today = startOfChicagoDay(now);
  const boxes =
    transportName() === "smtp" ? mailboxes().map((m) => m.user) : [s.fromEmail || process.env.SMTP_USER || "outreach@localhost"];
  const sent = await db.message.groupBy({
    by: ["fromEmail"],
    where: { direction: "OUT", status: "SENT", sentAt: { gte: today } },
    _count: true,
  });
  const used = new Map(sent.map((r) => [r.fromEmail ?? "", r._count]));
  return new Map(boxes.map((b) => [b, Math.max(0, s.dailySendCapPerMailbox - (used.get(b) ?? 0))]));
}

/** Run every due sequence step (inside the send window, within mailbox caps). */
export async function processDueEnrollments(now = new Date(), settings?: Settings) {
  const s = settings ?? (await getSettings());
  if (!inWindow(now, s)) return { summary: "Sequences: outside send window.", sent: 0, tasks: 0, failed: 0 };

  const capacity = await mailboxCapacity(s, now);
  const totalCapacity = [...capacity.values()].reduce((a, b) => a + b, 0);
  const due = await db.enrollment.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: s.maxSendsPerTick,
    include: {
      contact: true,
      messages: { where: { direction: "OUT" }, orderBy: { createdAt: "asc" } },
    },
  });
  const suppressed = new Set((await db.suppression.findMany({ select: { email: true } })).map((x) => x.email));

  let sent = 0;
  let tasks = 0;
  let failed = 0;
  for (const e of due) {
    const seq = getSequence(e.sequenceKey);
    const step = seq.steps[e.currentStep];
    if (!step) {
      await db.enrollment.update({ where: { id: e.id }, data: { status: "COMPLETED", nextRunAt: null } });
      await logDealEvent(e.dealId, "SEQUENCE_COMPLETED");
      continue;
    }
    const email = e.contact.email;
    if (!email || e.contact.doNotContact || suppressed.has(email)) {
      await db.enrollment.update({
        where: { id: e.id },
        data: { status: "STOPPED", stoppedReason: "suppressed", nextRunAt: null },
      });
      continue;
    }

    const ctx = await buildLeadContext(e.contactId, e.siteId, s);

    if (step.channel !== "EMAIL") {
      if (s.manualStepsAsTasks) {
        const t = taskText(ctx, step);
        await db.task.create({
          data: { type: step.channel, title: t.title, detail: t.detail, contactId: e.contactId, dealId: e.dealId, dueAt: now },
        });
        tasks++;
      }
      await advance(e.id, e.currentStep, step.day, seq.steps, now, s);
      continue;
    }

    const outs = e.messages.filter((m) => m.status === "SENT");
    const last = outs[outs.length - 1];
    // Threaded follow-ups must come from the mailbox that started the thread.
    let from = step.threaded && last?.fromEmail ? last.fromEmail : null;
    if (from && (capacity.get(from) ?? 0) <= 0) continue; // wait for tomorrow's capacity
    if (!from) {
      from = [...capacity.entries()].sort((a, b) => b[1] - a[1]).find(([, left]) => left > 0)?.[0] ?? null;
      if (!from) break; // every mailbox is at today's cap
    }
    if (totalCapacity - sent <= 0) break;

    const written = await writeEmail(
      ctx,
      step,
      outs.map((m) => ({ subject: m.subject, body: m.body })),
    );
    const firstSubject = outs.find((m) => m.subject && !m.subject.startsWith("Re:"))?.subject;
    const subject =
      step.threaded && last ? `Re: ${(last.subject ?? firstSubject ?? "").replace(/^Re:\s*/i, "")}` : written.subject || "permits";
    const text = composeBody(written.body, s, email);

    try {
      const res = await sendMail(
        {
          from,
          fromName: s.senderName,
          to: email,
          subject,
          text,
          replyTo: s.replyToEmail || undefined,
          inReplyTo: step.threaded ? last?.providerId : null,
          references: step.threaded ? outs.map((m) => m.providerId).filter((x): x is string => !!x) : undefined,
          bulk: true,
        },
        from,
      );
      await db.message.create({
        data: {
          enrollmentId: e.id,
          contactId: e.contactId,
          dealId: e.dealId,
          direction: "OUT",
          stepIndex: e.currentStep,
          fromEmail: res.mailbox,
          toEmail: email,
          subject,
          body: text,
          status: "SENT",
          providerId: res.messageId,
          inReplyTo: step.threaded ? last?.providerId : null,
          generatedBy: written.generatedBy,
          sentAt: new Date(),
        },
      });
      capacity.set(res.mailbox, (capacity.get(res.mailbox) ?? 1) - 1);
      sent++;
      if (e.dealId) {
        const deal = await db.deal.findUnique({ where: { id: e.dealId }, select: { stage: true } });
        if (deal?.stage === "NEW") {
          await db.deal.update({ where: { id: e.dealId }, data: { stage: "CONTACTED" } });
          await logDealEvent(e.dealId, "STAGE", "NEW → CONTACTED (first email sent)");
        }
      }
      await advance(e.id, e.currentStep, step.day, seq.steps, now, s);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await db.message.create({
        data: {
          enrollmentId: e.id,
          contactId: e.contactId,
          dealId: e.dealId,
          direction: "OUT",
          stepIndex: e.currentStep,
          fromEmail: from,
          toEmail: email,
          subject,
          body: text,
          status: "FAILED",
          error: msg.slice(0, 500),
        },
      });
      const failures = await db.message.count({ where: { enrollmentId: e.id, status: "FAILED" } });
      await db.enrollment.update({
        where: { id: e.id },
        data:
          failures >= 3
            ? { status: "STOPPED", stoppedReason: `send failed 3x: ${msg.slice(0, 120)}`, nextRunAt: null }
            : { nextRunAt: new Date(now.getTime() + 2 * 3_600_000) },
      });
    }
  }
  return {
    summary: `Sequences: ${sent} emails sent, ${tasks} call/LinkedIn tasks, ${failed} failures (${due.length} due).`,
    sent,
    tasks,
    failed,
  };
}

async function advance(
  enrollmentId: string,
  currentStep: number,
  currentDay: number,
  steps: { day: number }[],
  now: Date,
  s: Settings,
) {
  const next = steps[currentStep + 1];
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: next
      ? { currentStep: currentStep + 1, nextRunAt: scheduleAfter(now, next.day - currentDay, s) }
      : { currentStep: currentStep + 1, status: "COMPLETED", nextRunAt: null },
  });
}

/** Stop every active sequence for a contact (they replied, bounced, unsubscribed...). */
export async function stopEnrollments(contactId: string, status: string, reason: string) {
  await db.enrollment.updateMany({
    where: { contactId, status: { in: ["ACTIVE", "PAUSED"] } },
    data: { status, stoppedReason: reason, nextRunAt: null },
  });
}
