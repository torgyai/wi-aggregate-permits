/**
 * Delivery: from signed proposal to permits in hand.
 *   win -> project + intake link emailed -> client fills intake ->
 *   permit list re-assessed on real data -> drafts generated (cron, a few per tick) ->
 *   permitting lead reviews/files -> compliance calendar + reminders.
 */
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { generateDoc } from "./docs";
import { fmtDate } from "./format";
import { IntakeSchema, siteUpdateFromIntake, type Intake } from "./intake";
import { logDealEvent } from "./outreach/engine";
import { composeBody, sendMail } from "./outreach/mailer";
import { notifyOwner } from "./outreach/replies";
import { assessNeeds, profileFromSite } from "./permits/catalog";
import { nextDue, OBLIGATIONS, obligationsFor } from "./permits/obligations";
import { appUrl, getSettings } from "./settings";
import { randomToken } from "./tokens";

export const intakeUrl = (token: string) => `${appUrl()}/intake/${token}`;

async function clientRecipient(dealId: string) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: { proposal: true, company: true } });
  const contact = deal.primaryContactId ? await db.contact.findUnique({ where: { id: deal.primaryContactId } }) : null;
  return {
    deal,
    email: deal.proposal?.signerEmail || contact?.email || null,
    firstName: deal.proposal?.signerName?.split(" ")[0] || contact?.firstName || "there",
    contactId: contact?.id ?? null,
  };
}

async function emailClient(dealId: string, subject: string, body: string) {
  const s = await getSettings();
  const r = await clientRecipient(dealId);
  if (!r.email) return false;
  const text = composeBody(body, s, r.email, { withFooter: false });
  const res = await sendMail({ from: s.fromEmail, fromName: s.senderName, to: r.email, subject, text, replyTo: s.replyToEmail || undefined });
  await db.message.create({
    data: {
      direction: "OUT",
      contactId: r.contactId,
      dealId,
      fromEmail: res.mailbox,
      toEmail: r.email,
      subject,
      body: text,
      status: "SENT",
      providerId: res.messageId,
      generatedBy: "template",
      sentAt: new Date(),
    },
  });
  return true;
}

export async function createProjectForDeal(dealId: string) {
  const existing = await db.project.findUnique({ where: { dealId } });
  if (existing) return existing;
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: { site: true, company: true } });
  const project = await db.project.create({
    data: { dealId, siteId: deal.siteId, intakeToken: randomToken(), status: "INTAKE" },
  });
  // Provisional permit list from what we know; re-assessed when intake arrives.
  if (deal.site) await syncPermitItems(project.id, profileFromSite(deal.site));
  const r = await clientRecipient(dealId);
  await emailClient(
    dealId,
    `Next step for ${deal.site?.name ?? deal.company.name}: site questionnaire`,
    [
      `Hi ${r.firstName},`,
      `Thanks for signing — we're underway. The one thing we need from you is a short site questionnaire (about 15 minutes; "don't know" is a fine answer):`,
      intakeUrl(project.intakeToken),
      `Once it's in, we draft every application and plan and send them to you for review.`,
    ].join("\n\n"),
  );
  await db.task.create({
    data: { type: "MEETING", title: `Kickoff call: ${deal.company.name}`, detail: "Introduce the team, confirm site boundary and timeline.", dealId, projectId: project.id },
  });
  await logDealEvent(dealId, "PROJECT_CREATED", "Intake link sent");
  return project;
}

async function syncPermitItems(projectId: string, profile: Parameters<typeof assessNeeds>[0]) {
  const needs = assessNeeds(profile);
  for (const n of needs) {
    const inScope = n.status !== "NO" && n.status !== "OPTIONAL";
    const existing = await db.permitItem.findUnique({ where: { projectId_key: { projectId, key: n.key } } });
    if (existing) {
      // Don't clobber progress; only toggle scope for items nobody has started.
      if (["NOT_STARTED", "NOT_REQUIRED"].includes(existing.status)) {
        await db.permitItem.update({
          where: { id: existing.id },
          data: { status: inScope ? "NOT_STARTED" : "NOT_REQUIRED", reason: n.reason },
        });
      }
      continue;
    }
    if (!inScope && n.status !== "OPTIONAL") continue;
    await db.permitItem.create({
      data: {
        projectId,
        key: n.key,
        name: n.name,
        agency: n.agency,
        status: inScope ? "NOT_STARTED" : "NOT_REQUIRED",
        reason: n.reason,
        targetDate: new Date(Date.now() + n.typicalWeeks[1] * 7 * 86_400_000),
      },
    });
  }
}

export async function submitIntake(token: string, raw: unknown): Promise<{ projectId: string }> {
  const project = await db.project.findUnique({ where: { intakeToken: token }, include: { deal: { include: { company: true } } } });
  if (!project) throw new Error("Intake link not found");
  const intake = IntakeSchema.parse(raw);
  const siteData = siteUpdateFromIntake(intake);

  let siteId = project.siteId;
  if (siteId) await db.site.update({ where: { id: siteId }, data: siteData });
  else {
    const site = await db.site.create({ data: { ...siteData, companyId: project.deal.companyId } });
    siteId = site.id;
    await db.deal.update({ where: { id: project.dealId }, data: { siteId } });
  }
  const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
  await syncPermitItems(project.id, profileFromSite(site, { ownershipChange: intake.projectType === "transfer" }));

  // Compliance calendar for everything in scope.
  const keys = (await db.permitItem.findMany({ where: { projectId: project.id, status: { not: "NOT_REQUIRED" } } })).map((p) => p.key);
  await db.obligation.deleteMany({ where: { projectId: project.id, status: "UPCOMING" } });
  const obs = obligationsFor(keys);
  if (obs.length) {
    await db.obligation.createMany({
      data: obs.map((o) => ({
        projectId: project.id,
        key: o.key,
        title: o.title,
        detail: o.detail,
        citation: o.citation,
        cadence: o.cadence,
        dueAt: o.dueAt,
      })),
    });
  }

  await db.project.update({
    where: { id: project.id },
    data: {
      intake: intake as unknown as Prisma.InputJsonValue,
      intakeSubmittedAt: new Date(),
      siteId,
      status: "DRAFTING",
    },
  });
  await logDealEvent(project.dealId, "INTAKE_SUBMITTED", `${keys.length} permits in scope`);
  await notifyOwner(
    `Intake received: ${project.deal.company.name}`,
    `${intake.siteName} (${intake.county} County). ${keys.length} permits in scope. Drafts are generating now.\n\n${appUrl()}/projects/${project.id}`,
  );
  return { projectId: project.id };
}

/** Generate drafts for permit items that don't have one yet (a few per cron tick). */
export async function generatePendingDocs(limit = 2) {
  const s = await getSettings();
  const items = await db.permitItem.findMany({
    where: {
      status: "NOT_STARTED",
      project: { intakeSubmittedAt: { not: null } },
    },
    include: { project: { include: { documents: { select: { permitKey: true } }, deal: { include: { company: true, site: true } } } } },
    take: 20,
    orderBy: { createdAt: "asc" },
  });
  let generated = 0;
  for (const item of items) {
    if (generated >= limit) break;
    if (item.project.documents.some((d) => d.permitKey === item.key)) continue;
    const site = item.project.deal.site;
    const doc = await generateDoc({
      permitKey: item.key,
      intake: item.project.intake as unknown as Intake,
      site: {
        commodity: site?.commodity ?? "SAND_GRAVEL",
        mshaMineId: site?.mshaMineId ?? null,
        latitude: site?.latitude ?? null,
        longitude: site?.longitude ?? null,
      },
      client: { name: item.project.deal.company.name },
      firm: { name: s.companyName, contact: [s.senderName, s.phone].filter(Boolean).join(", ") },
    });
    await db.generatedDoc.create({
      data: { projectId: item.projectId, permitKey: item.key, title: doc.title, content: doc.markdown, generatedBy: doc.by },
    });
    await db.permitItem.update({ where: { id: item.id }, data: { status: "DRAFTING" } });
    generated++;

    const remaining = await db.permitItem.count({ where: { projectId: item.projectId, status: "NOT_STARTED" } });
    if (remaining === 0) {
      await db.task.create({
        data: {
          type: "PERMIT",
          title: `Review drafts: ${item.project.deal.company.name}`,
          detail: "All permit drafts are generated. Review, resolve [CONFIRM] items with the client, then mark items Ready to file.",
          dealId: item.project.dealId,
          projectId: item.projectId,
        },
      });
      await notifyOwner(`Drafts ready: ${item.project.deal.company.name}`, `${appUrl()}/projects/${item.projectId}`, s);
    }
  }
  return { summary: `Docs: ${generated} permit drafts generated.`, generated };
}

/** Nudge clients who haven't filled the intake (days 2, 5, 9). */
export async function intakeReminders(now = new Date()) {
  const pending = await db.project.findMany({
    where: { status: "INTAKE", intakeSubmittedAt: null },
    include: { deal: { include: { company: true } } },
  });
  let sent = 0;
  for (const p of pending) {
    const age = (now.getTime() - p.createdAt.getTime()) / 86_400_000;
    const since = p.intakeRemindedAt ? (now.getTime() - p.intakeRemindedAt.getTime()) / 86_400_000 : age;
    const count = await db.dealEvent.count({ where: { dealId: p.dealId, type: "INTAKE_REMINDER" } });
    const due = (count === 0 && age >= 2) || (count === 1 && since >= 3) || (count === 2 && since >= 4);
    if (!due) continue;
    const r = await clientRecipient(p.dealId);
    const ok = await emailClient(
      p.dealId,
      "Site questionnaire",
      `Hi ${r.firstName},\n\nQuick reminder — the site questionnaire is the one thing holding up the drafts:\n${intakeUrl(p.intakeToken)}\n\nIf it's easier, reply with a good time and we'll fill it in together over the phone.`,
    );
    if (ok) {
      await db.project.update({ where: { id: p.id }, data: { intakeRemindedAt: now } });
      await logDealEvent(p.dealId, "INTAKE_REMINDER", `#${count + 1}`);
      sent++;
    }
    if (count === 2) {
      await db.task.create({
        data: { type: "CALL", title: `Call for intake: ${p.deal.company.name}`, detail: "Three reminders sent; fill it in by phone.", dealId: p.dealId, projectId: p.id },
      });
    }
  }
  return { summary: `Intake: ${sent} reminders.`, sent };
}

/** Compliance calendar: remind clients 14 days out, flag overdue, roll recurring items forward. */
export async function obligationSweep(now = new Date()) {
  const s = await getSettings();
  await db.obligation.updateMany({ where: { status: "UPCOMING", dueAt: { lt: now } }, data: { status: "OVERDUE" } });

  const soon = await db.obligation.findMany({
    where: { status: "UPCOMING", remindedAt: null, dueAt: { lte: new Date(now.getTime() + 14 * 86_400_000) } },
    include: { project: { include: { deal: { include: { company: true } } } } },
  });
  let reminded = 0;
  for (const o of soon) {
    const r = await clientRecipient(o.project.dealId);
    await emailClient(
      o.project.dealId,
      `Due ${fmtDate(o.dueAt)}: ${o.title}`,
      `Hi ${r.firstName},\n\nHeads-up: ${o.title.toLowerCase()} is due ${fmtDate(o.dueAt)}.\n\n${o.detail ?? ""}${
        s.retainerMonthly ? `\n\nIf you'd like us to take care of it, reply "handle it" — it's covered under the compliance plan.` : ""
      }`,
    );
    await db.obligation.update({ where: { id: o.id }, data: { remindedAt: now } });
    await db.task.create({
      data: {
        type: "PERMIT",
        title: `${o.title} — ${o.project.deal.company.name}`,
        detail: `Due ${fmtDate(o.dueAt)}. ${o.citation ?? ""}`,
        dueAt: o.dueAt,
        dealId: o.project.dealId,
        projectId: o.projectId,
      },
    });
    reminded++;
  }
  return { summary: `Compliance: ${reminded} reminders.`, reminded };
}

/** Mark an obligation done and schedule the next occurrence for recurring ones. */
export async function completeObligation(id: string) {
  const o = await db.obligation.update({ where: { id }, data: { status: "DONE", doneAt: new Date() } });
  const def = OBLIGATIONS.find((d) => d.key === o.key);
  if (def && def.cadence !== "ONE_TIME") {
    await db.obligation.create({
      data: {
        projectId: o.projectId,
        key: o.key,
        title: o.title,
        detail: o.detail,
        citation: o.citation,
        cadence: o.cadence,
        dueAt: nextDue(def, new Date(o.dueAt.getTime() + 86_400_000)),
      },
    });
  }
}

// ---------------------------------------------------------------- client portal

export const portalUrl = (token: string) => `${appUrl()}/c/${token}`;

/** Put drafts in front of the client: permits with a draft move to Client review; client gets the portal link. */
export async function shareDraftsWithClient(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { deal: { include: { company: true, site: true } } } });
  await db.permitItem.updateMany({ where: { projectId, status: "DRAFTING" }, data: { status: "CLIENT_REVIEW" } });
  await db.project.update({ where: { id: projectId }, data: { sharedAt: new Date(), status: "CLIENT_REVIEW" } });
  const r = await clientRecipient(project.dealId);
  await emailClient(
    project.dealId,
    `Drafts ready for your review: ${project.deal.site?.name ?? project.deal.company.name}`,
    [
      `Hi ${r.firstName},`,
      `Your permit drafts are ready. Each one is on your project page — read it, answer anything highlighted "CONFIRM", and click Approve (or leave a comment):`,
      portalUrl(project.intakeToken),
      `Once they're approved we file with the county and WDNR.`,
    ].join("\n\n"),
  );
  await logDealEvent(project.dealId, "DRAFTS_SHARED", "Client portal link sent");
}

/** Client approves (or comments on) a draft from the portal. */
export async function clientReviewDoc(token: string, docId: string, approve: boolean, comment: string) {
  const project = await db.project.findUnique({ where: { intakeToken: token }, include: { deal: { include: { company: true } } } });
  if (!project) throw new Error("Project not found");
  const doc = await db.generatedDoc.findFirst({ where: { id: docId, projectId: project.id } });
  if (!doc) throw new Error("Draft not found");
  await db.generatedDoc.update({
    where: { id: doc.id },
    data: { clientApprovedAt: approve ? new Date() : null, clientComment: comment || doc.clientComment },
  });
  if (approve && doc.permitKey) {
    await db.permitItem.updateMany({
      where: { projectId: project.id, key: doc.permitKey, status: { in: ["DRAFTING", "CLIENT_REVIEW"] } },
      data: { status: "READY_TO_FILE" },
    });
  }
  await logDealEvent(project.dealId, approve ? "CLIENT_APPROVED" : "CLIENT_COMMENT", `${doc.title}${comment ? `: ${comment}` : ""}`);
  await db.task.create({
    data: {
      type: "PERMIT",
      title: approve ? `File: ${doc.title.replace(" — working draft", "")} (${project.deal.company.name})` : `Client comment on ${doc.title}`,
      detail: comment || (approve ? "Client approved — ready to file with the agency." : undefined),
      dealId: project.dealId,
      projectId: project.id,
    },
  });
  await notifyOwner(
    `${approve ? "Approved" : "Comment"}: ${doc.title} — ${project.deal.company.name}`,
    `${comment || "(no comment)"}\n\n${appUrl()}/projects/${project.id}`,
  );
}

/** Client opts into the monthly compliance plan from the portal. */
export async function startCompliancePlan(token: string) {
  const project = await db.project.findUnique({ where: { intakeToken: token }, include: { deal: { include: { company: true } } } });
  if (!project || project.retainerActive) return;
  await db.project.update({ where: { id: project.id }, data: { retainerActive: true, retainerStartedAt: new Date() } });
  if (project.deal.retainerMonthly == null) {
    const { getSettings } = await import("./settings");
    await db.deal.update({ where: { id: project.dealId }, data: { retainerMonthly: (await getSettings()).retainerMonthly } });
  }
  await logDealEvent(project.dealId, "RETAINER_STARTED", `${project.deal.retainerMonthly ?? ""}/mo`);
  await db.task.create({
    data: {
      type: "OTHER",
      title: `Set up compliance plan billing: ${project.deal.company.name}`,
      detail: "Client opted in on the portal. Create the monthly subscription (Stripe) or invoice schedule.",
      dealId: project.dealId,
      projectId: project.id,
    },
  });
  await notifyOwner(`Compliance plan started: ${project.deal.company.name}`, `${appUrl()}/projects/${project.id}`);
}

/** Signed but deposit unpaid (Stripe only): remind on days 3 and 7, then hand to a human. */
export async function depositReminders(now = new Date()) {
  if (!process.env.STRIPE_SECRET_KEY) return { summary: "Deposits: Stripe not configured.", sent: 0 };
  const open = await db.proposal.findMany({
    where: { status: "ACCEPTED", depositPaidAt: null, depositPct: { gt: 0 }, acceptedAt: { not: null } },
    include: { deal: { include: { company: true } } },
  });
  let sent = 0;
  for (const p of open) {
    const days = (now.getTime() - p.acceptedAt!.getTime()) / 86_400_000;
    const count = await db.dealEvent.count({ where: { dealId: p.dealId, type: "DEPOSIT_REMINDER" } });
    if (!((count === 0 && days >= 3) || (count === 1 && days >= 7))) continue;
    const r = await clientRecipient(p.dealId);
    await emailClient(
      p.dealId,
      "Deposit to get started",
      `Hi ${r.firstName},\n\nA quick reminder that the deposit starts the clock on your permits. You can pay by bank transfer or card here:\n${appUrl()}/p/${p.token}\n\nIf you'd rather pay by check or invoice, just reply and we'll send one.`,
    );
    await logDealEvent(p.dealId, "DEPOSIT_REMINDER", `#${count + 1}`);
    if (count === 1) {
      await db.task.create({ data: { type: "CALL", title: `Deposit unpaid: ${p.deal.company.name}`, detail: "Two reminders sent. Call to collect or send an invoice.", dealId: p.dealId } });
    }
    sent++;
  }
  return { summary: `Deposits: ${sent} reminders.`, sent };
}
