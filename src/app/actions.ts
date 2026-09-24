"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { tick } from "@/lib/autopilot";
import { db } from "@/lib/db";
import { completeObligation, generatePendingDocs, submitIntake } from "@/lib/delivery";
import { runJob } from "@/lib/jobs";
import { DEFAULT_SEQUENCE_KEY } from "@/lib/outreach/sequence";
import { logDealEvent } from "@/lib/outreach/engine";
import { nextSendTime } from "@/lib/outreach/window";
import { sendPending, unsubscribe } from "@/lib/outreach/replies";
import { acceptProposal, createDepositCheckout, createProposal, declineProposal, sendProposal } from "@/lib/proposals";
import { enrichTopCompanies, importContactsCsv, rescoreSites, syncMsha } from "@/lib/prospecting";
import { checkPassword, createSession, readSession, SESSION_COOKIE } from "@/lib/session";
import { getSettings, saveSettings, SettingsSchema } from "@/lib/settings";
import { readUnsubscribeToken } from "@/lib/tokens";
import { syncWdnrApplications } from "@/lib/wdnr";
import { normalizeCompanyName } from "@/lib/msha";
import { repriceDeal } from "@/lib/quote";
import { loadTargetAccounts } from "@/lib/target-load";
import { TRAINING_KEY } from "@/lib/training";
import { clientReviewDoc, portalUrl, shareDraftsWithClient, startCompliancePlan } from "@/lib/delivery";
import { createCheckout, markBalancePaid, markDepositPaid } from "@/lib/proposals";
import { composeBody, sendMail } from "@/lib/outreach/mailer";

// Server actions are reachable from any route, so each admin action checks the
// session itself rather than relying on the path-based middleware.
async function requireAdmin() {
  const s = await readSession(cookies().get(SESSION_COOKIE)?.value);
  if (!s) redirect("/login");
  return s;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------------------------------------------------------------- auth

export async function login(form: FormData) {
  const email = str(form, "email");
  const next = str(form, "next") || "/";
  if (!(await checkPassword(email, str(form, "password")))) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  const { value, maxAge } = await createSession(email.toLowerCase());
  cookies().set(SESSION_COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge, path: "/" });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------- autopilot + data

export async function runTickNow() {
  await requireAdmin();
  await tick();
  revalidatePath("/", "layout");
}

export async function syncMshaNow() {
  await requireAdmin();
  await runJob("msha", () => syncMsha());
  revalidatePath("/", "layout");
}

export async function syncWdnrNow() {
  await requireAdmin();
  await runJob("wdnr", () => syncWdnrApplications());
  revalidatePath("/", "layout");
}

export async function enrichNow() {
  await requireAdmin();
  await runJob("enrich", () => enrichTopCompanies(15));
  revalidatePath("/", "layout");
}

export async function rescoreNow() {
  await requireAdmin();
  await runJob("rescore", async () => ({ summary: `Rescored ${await rescoreSites()} sites.` }));
  revalidatePath("/", "layout");
}

export async function importCsv(form: FormData) {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a CSV file");
  const text = await file.text();
  await runJob("csv-import", () => importContactsCsv(text));
  revalidatePath("/", "layout");
}

export async function updateSettings(form: FormData) {
  await requireAdmin();
  const current = await getSettings();
  const shape = SettingsSchema.shape;
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const cur = current[key];
    if (typeof cur === "boolean") patch[key] = form.get(key) === "on";
    else if (!form.has(key)) continue;
    else if (typeof cur === "number") patch[key] = Number(form.get(key));
    else if (Array.isArray(cur)) patch[key] = form.getAll(key).map(Number);
    else patch[key] = str(form, key);
  }
  await saveSettings(patch);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- leads

export async function enrollSite(siteId: string) {
  await requireAdmin();
  const s = await getSettings();
  const site = await db.site.findUniqueOrThrow({
    where: { id: siteId },
    include: { company: { include: { contacts: { where: { email: { not: null }, doNotContact: false } } } } },
  });
  const contact = site.company?.contacts[0];
  if (!site.company || !contact) throw new Error("Add a contact with an email first");
  const open = await db.deal.findFirst({ where: { companyId: site.company.id, stage: { notIn: ["WON", "LOST"] } } });
  const deal =
    open ??
    (await db.deal.create({
      data: { companyId: site.company.id, siteId, primaryContactId: contact.id, value: s.packagePrice, source: "OUTBOUND" },
    }));
  await repriceDeal(deal.id, s);
  await db.enrollment.upsert({
    where: { contactId_sequenceKey: { contactId: contact.id, sequenceKey: DEFAULT_SEQUENCE_KEY } },
    create: { contactId: contact.id, siteId, dealId: deal.id, sequenceKey: DEFAULT_SEQUENCE_KEY, nextRunAt: nextSendTime(new Date(), s) },
    update: {},
  });
  await logDealEvent(deal.id, "ENROLLED", `Manually enrolled ${contact.email}`);
  revalidatePath(`/sites/${siteId}`);
}

export async function updateSiteFacts(siteId: string, form: FormData) {
  await requireAdmin();
  const tri = (k: string) => (form.get(k) === "yes" ? true : form.get(k) === "no" ? false : null);
  const acres = str(form, "acreage");
  await db.site.update({
    where: { id: siteId },
    data: {
      plannedExpansion: tri("plannedExpansion"),
      crushing: tri("crushing"),
      washing: tri("washing"),
      dewatering: tri("dewatering"),
      blasting: tri("blasting"),
      acreage: acres ? Number(acres) : null,
    },
  });
  if (form.get("plannedExpansion") === "yes") {
    await db.signal.create({ data: { siteId, type: "EXPANSION", title: "Expansion noted by operator", weight: 25 } });
  }
  await rescoreSites([siteId]);
  revalidatePath(`/sites/${siteId}`);
}

export async function addContact(companyId: string, form: FormData) {
  await requireAdmin();
  const email = str(form, "email").toLowerCase();
  if (!email.includes("@")) throw new Error("Email required");
  await db.contact.upsert({
    where: { email },
    create: {
      companyId,
      email,
      firstName: str(form, "firstName") || null,
      lastName: str(form, "lastName") || null,
      title: str(form, "title") || null,
      phone: str(form, "phone") || null,
      source: "MANUAL",
    },
    update: { title: str(form, "title") || undefined, phone: str(form, "phone") || undefined },
  });
  const sites = await db.site.findMany({ where: { companyId }, select: { id: true } });
  await rescoreSites(sites.map((s) => s.id));
  revalidatePath("/sites", "layout");
}

export async function addSignal(siteId: string, form: FormData) {
  await requireAdmin();
  const site = await db.site.findUniqueOrThrow({ where: { id: siteId } });
  await db.signal.create({
    data: { siteId, companyId: site.companyId, type: str(form, "type") || "MANUAL", title: str(form, "title"), detail: str(form, "detail") || null },
  });
  await rescoreSites([siteId]);
  revalidatePath(`/sites/${siteId}`);
}

export async function createCompanyAndSite(form: FormData) {
  await requireAdmin();
  const name = str(form, "company");
  const norm = normalizeCompanyName(name);
  const company =
    (await db.company.findUnique({ where: { normalizedName: norm } })) ??
    (await db.company.create({ data: { name, normalizedName: norm, source: "MANUAL", state: "WI" } }));
  const site = await db.site.create({
    data: {
      name: str(form, "site") || `${name} site`,
      companyId: company.id,
      county: str(form, "county") || null,
      commodity: str(form, "commodity") || "SAND_GRAVEL",
      isNewSite: form.get("isNewSite") === "on",
    },
  });
  await rescoreSites([site.id]);
  redirect(`/sites/${site.id}`);
}

// ---------------------------------------------------------------- deals

export async function setDealStage(dealId: string, form: FormData) {
  await requireAdmin();
  const stage = str(form, "stage");
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  await db.deal.update({
    where: { id: dealId },
    data: {
      stage,
      lostReason: stage === "LOST" ? str(form, "reason") || "Closed lost" : deal.lostReason,
      meetingAt: stage === "MEETING" && str(form, "meetingAt") ? new Date(str(form, "meetingAt")) : deal.meetingAt,
      wonAt: stage === "WON" ? new Date() : deal.wonAt,
    },
  });
  if (stage === "LOST" || stage === "WON") {
    await db.enrollment.updateMany({
      where: { dealId, status: "ACTIVE" },
      data: { status: "STOPPED", stoppedReason: `deal ${stage.toLowerCase()}`, nextRunAt: null },
    });
  }
  await logDealEvent(dealId, "STAGE", `${deal.stage} → ${stage} (manual)`);
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/pipeline");
}

export async function addNote(dealId: string, form: FormData) {
  await requireAdmin();
  const note = str(form, "note");
  if (note) await logDealEvent(dealId, "NOTE", note);
  revalidatePath(`/deals/${dealId}`);
}

export async function createAndSendProposal(dealId: string) {
  await requireAdmin();
  const p = await createProposal(dealId);
  await sendProposal(p.id);
  revalidatePath(`/deals/${dealId}`);
}

export async function draftProposal(dealId: string) {
  await requireAdmin();
  await createProposal(dealId);
  revalidatePath(`/deals/${dealId}`);
}

// ---------------------------------------------------------------- inbox + tasks

export async function approveReply(messageId: string, form: FormData) {
  await requireAdmin();
  await sendPending(messageId, str(form, "body"));
  revalidatePath("/inbox");
}

export async function discardReply(messageId: string) {
  await requireAdmin();
  await db.message.update({ where: { id: messageId }, data: { status: "SKIPPED" } });
  await db.task.updateMany({ where: { messageId, status: "OPEN" }, data: { status: "SKIPPED", completedAt: new Date() } });
  revalidatePath("/inbox");
}

export async function completeTask(taskId: string) {
  await requireAdmin();
  await db.task.update({ where: { id: taskId }, data: { status: "DONE", completedAt: new Date() } });
  revalidatePath("/tasks");
}

export async function skipTask(taskId: string) {
  await requireAdmin();
  await db.task.update({ where: { id: taskId }, data: { status: "SKIPPED", completedAt: new Date() } });
  revalidatePath("/tasks");
}

// ---------------------------------------------------------------- projects

export async function setPermitStatus(itemId: string, form: FormData) {
  await requireAdmin();
  const status = str(form, "status");
  const item = await db.permitItem.update({
    where: { id: itemId },
    data: {
      status,
      submittedAt: status === "SUBMITTED" ? new Date() : undefined,
      approvedAt: status === "APPROVED" ? new Date() : undefined,
    },
    include: { project: true },
  });
  // Project status follows its permits.
  const items = await db.permitItem.findMany({ where: { projectId: item.projectId, status: { not: "NOT_REQUIRED" } } });
  const all = (ss: string[]) => items.length > 0 && items.every((i) => ss.includes(i.status));
  const next = all(["APPROVED"])
    ? "COMPLIANCE"
    : all(["SUBMITTED", "AGENCY_REVIEW", "APPROVED"])
      ? "AGENCY_REVIEW"
      : all(["READY_TO_FILE", "SUBMITTED", "AGENCY_REVIEW", "APPROVED"])
        ? "FILING"
        : items.some((i) => i.status === "CLIENT_REVIEW")
          ? "CLIENT_REVIEW"
          : item.project.status;
  if (next !== item.project.status) {
    await db.project.update({ where: { id: item.projectId }, data: { status: next } });
    await logDealEvent(item.project.dealId, "PROJECT_STATUS", next);
  }
  revalidatePath(`/projects/${item.projectId}`);
}

export async function completeObligationAction(id: string, projectId: string) {
  await requireAdmin();
  await completeObligation(id);
  revalidatePath(`/projects/${projectId}`);
}

export async function generateDocsNow(projectId: string) {
  await requireAdmin();
  await runJob("docs", () => generatePendingDocs(3));
  revalidatePath(`/projects/${projectId}`);
}

export async function regenerateDoc(projectId: string, permitKey: string) {
  await requireAdmin();
  await db.permitItem.updateMany({ where: { projectId, key: permitKey }, data: { status: "NOT_STARTED" } });
  await db.generatedDoc.deleteMany({ where: { projectId, permitKey } });
  await generatePendingDocs(1);
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------- public (token-authorized)

export async function acceptProposalAction(token: string, form: FormData) {
  const name = str(form, "name");
  const email = str(form, "email");
  const fail = (msg: string) => redirect(`/p/${token}?error=${encodeURIComponent(msg)}#accept`);
  if (form.get("agree") !== "on") fail("Please confirm you agree to the terms.");
  if (name.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Please enter your full name and email.");
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  try {
    await acceptProposal(token, { name, title: str(form, "title"), email, ip });
  } catch (err) {
    fail(err instanceof Error ? err.message : "Could not accept the proposal.");
  }
  const checkout = await createDepositCheckout(token).catch(() => null);
  redirect(checkout ?? `/p/${token}?accepted=1`);
}

export async function payDepositAction(token: string) {
  const checkout = await createDepositCheckout(token);
  redirect(checkout ?? `/p/${token}`);
}

export async function declineProposalAction(token: string, form: FormData) {
  await declineProposal(token, str(form, "reason"));
  redirect(`/p/${token}?declined=1`);
}

export async function submitIntakeAction(token: string, form: FormData) {
  const raw: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$")) raw[key] = value;
  });
  await submitIntake(token, raw);
  redirect(`/c/${token}?welcome=1`);
}

export async function unsubscribeAction(token: string) {
  const email = readUnsubscribeToken(token);
  if (email) await unsubscribe(email, "link");
  redirect(`/u/${token}?done=1`);
}

// ---------------------------------------------------------------- v2: pricing, control, portal, training

export async function loadTargetAccountsAction() {
  await requireAdmin();
  await runJob("targets", () => loadTargetAccounts());
  revalidatePath("/", "layout");
}

export async function setDealPrice(dealId: string, form: FormData) {
  await requireAdmin();
  const price = Number(str(form, "price"));
  const retainer = str(form, "retainer");
  if (!price || price < 1000) throw new Error("Enter a price");
  await db.deal.update({
    where: { id: dealId },
    data: { value: price, priceOverridden: true, retainerMonthly: retainer ? Number(retainer) : undefined, pricingTier: str(form, "tier") || undefined },
  });
  await logDealEvent(dealId, "PRICE_SET", `$${price.toLocaleString()} (manual)`);
  revalidatePath(`/deals/${dealId}`);
}

export async function resetDealPrice(dealId: string) {
  await requireAdmin();
  await db.deal.update({ where: { id: dealId }, data: { priceOverridden: false } });
  const d = await repriceDeal(dealId, await getSettings());
  await logDealEvent(dealId, "PRICE_SET", `$${d.value.toLocaleString()} (engine)`);
  revalidatePath(`/deals/${dealId}`);
}

export async function setOutreachPaused(dealId: string, paused: boolean) {
  await requireAdmin();
  const s = await getSettings();
  await db.enrollment.updateMany({
    where: { dealId, status: paused ? "ACTIVE" : "PAUSED" },
    data: paused ? { status: "PAUSED" } : { status: "ACTIVE", nextRunAt: nextSendTime(new Date(), s) },
  });
  await logDealEvent(dealId, paused ? "OUTREACH_PAUSED" : "OUTREACH_RESUMED");
  revalidatePath(`/deals/${dealId}`);
}

export async function setCompanyExcluded(companyId: string, excluded: boolean) {
  await requireAdmin();
  await db.company.update({ where: { id: companyId }, data: { excluded } });
  if (excluded) {
    const contacts = await db.contact.findMany({ where: { companyId }, select: { id: true } });
    await db.enrollment.updateMany({
      where: { contactId: { in: contacts.map((c) => c.id) }, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "STOPPED", stoppedReason: "company excluded", nextRunAt: null },
    });
  }
  revalidatePath("/", "layout");
}

/** One-off email from a deal (goes through the same send lock: dry run unless LIVE_SEND=on). */
export async function sendManualEmail(dealId: string, form: FormData) {
  await requireAdmin();
  const s = await getSettings();
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
  const contact = deal.primaryContactId ? await db.contact.findUnique({ where: { id: deal.primaryContactId } }) : null;
  if (!contact?.email) throw new Error("No contact email on this deal");
  const suppressed = await db.suppression.findUnique({ where: { email: contact.email } });
  if (suppressed || contact.doNotContact) throw new Error("This contact unsubscribed");
  const last = await db.message.findFirst({ where: { contactId: contact.id, status: "SENT" }, orderBy: { createdAt: "desc" } });
  const subject = str(form, "subject") || (last?.subject ? `Re: ${last.subject.replace(/^Re:\s*/i, "")}` : "Following up");
  const text = composeBody(str(form, "body"), s, contact.email);
  const res = await sendMail(
    { from: last?.fromEmail || s.fromEmail, fromName: s.senderName, to: contact.email, subject, text, replyTo: s.replyToEmail || undefined, inReplyTo: last?.providerId, bulk: true },
    last?.fromEmail ?? undefined,
  );
  await db.message.create({
    data: { direction: "OUT", contactId: contact.id, dealId, fromEmail: res.mailbox, toEmail: contact.email, subject, body: text, status: "SENT", providerId: res.messageId, generatedBy: "manual", sentAt: new Date() },
  });
  await logDealEvent(dealId, "EMAIL_SENT", subject);
  revalidatePath(`/deals/${dealId}`);
}

export async function shareDraftsAction(projectId: string) {
  await requireAdmin();
  await shareDraftsWithClient(projectId);
  revalidatePath(`/projects/${projectId}`);
}

export async function markPaidAction(projectId: string, kind: "deposit" | "balance") {
  await requireAdmin();
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { deal: { include: { proposal: true } } } });
  const p = project.deal.proposal;
  if (!p) throw new Error("No proposal on this deal");
  await (kind === "deposit" ? markDepositPaid(p.id) : markBalancePaid(p.id));
  revalidatePath(`/projects/${projectId}`);
}

export async function toggleLesson(slug: string) {
  await requireAdmin();
  const row = await db.setting.findUnique({ where: { key: TRAINING_KEY } });
  const done = new Set<string>(row ? (JSON.parse(row.value) as string[]) : []);
  done.has(slug) ? done.delete(slug) : done.add(slug);
  const value = JSON.stringify([...done]);
  await db.setting.upsert({ where: { key: TRAINING_KEY }, create: { key: TRAINING_KEY, value }, update: { value } });
  revalidatePath("/training", "layout");
}

// ---------------------------------------------------------------- client portal (token-authorized)

export async function clientReviewAction(token: string, docId: string, form: FormData) {
  const approve = form.get("decision") === "approve";
  await clientReviewDoc(token, docId, approve, str(form, "comment"));
  redirect(`/c/${token}?reviewed=1#docs`);
}

export async function startPlanAction(token: string) {
  await startCompliancePlan(token);
  redirect(`/c/${token}?plan=1`);
}

export async function payBalanceAction(token: string) {
  const project = await db.project.findUnique({ where: { intakeToken: token }, include: { deal: { include: { proposal: true } } } });
  const p = project?.deal.proposal;
  const url = p ? await createCheckout(p.token, "balance", portalUrl(token)) : null;
  redirect(url ?? `/c/${token}`);
}
