/**
 * Proposals: scope is generated from the site's permit needs, priced at the
 * flat package fee, published at an unguessable link, accepted with a typed
 * signature, and (optionally) the deposit is collected by Stripe Checkout.
 */
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { COMMODITY_LABEL } from "./enums";
import { usd } from "./format";
import { assessNeeds, estimateTimelineWeeks, profileFromSite, signalFlags, type NeedsItem } from "./permits/catalog";
import { appUrl, getSettings, type Settings } from "./settings";
import { repriceDeal } from "./quote";
import { randomToken } from "./tokens";
import { composeBody, sendMail } from "./outreach/mailer";
import { logDealEvent } from "./outreach/engine";

export type ProposalScope = {
  packageName: string;
  clientName: string;
  siteName: string | null;
  county: string | null;
  commodity: string | null;
  included: Pick<NeedsItem, "key" | "name" | "agency" | "status" | "reason" | "deliverables" | "citation">[];
  optional: Pick<NeedsItem, "key" | "name" | "reason">[];
  alsoIncluded: string[];
  timelineWeeks: [number, number];
  exclusions: string[];
  paymentTerms: string;
  retainer: { monthly: number; description: string };
};

export const EXCLUSIONS = [
  "Third-party field work: surveying, wetland delineation, hydrogeologic studies, groundwater modeling, soil borings, air dispersion modeling, stack/opacity testing",
  "Agency, application and annual permit fees; reclamation bond/letter of credit premiums",
  "Contested case hearings, litigation, or more than two public hearing appearances",
  "Engineering design stamped by a PE where an agency requires it (coordinated at cost if needed)",
];

export function buildScope(
  s: Settings,
  deal: { company: { name: string }; site: Parameters<typeof profileFromSite>[0] & { name: string } | null },
  opts: { ownershipChange?: boolean; plannedExpansion?: boolean } = {},
  pricing: { price: number; retainerMonthly: number } = { price: s.packagePrice, retainerMonthly: s.retainerMonthly },
): ProposalScope {
  const needs = deal.site
    ? assessNeeds(profileFromSite(deal.site, opts))
    : assessNeeds({ commodity: "SAND_GRAVEL", ...opts });
  const included = needs.filter((n) => n.status === "REQUIRED" || n.status === "LIKELY" || n.status === "CHECK");
  const optional = needs.filter((n) => n.status === "OPTIONAL");
  const deposit = s.depositPct;
  return {
    packageName: s.packageName,
    clientName: deal.company.name,
    siteName: deal.site?.name ?? null,
    county: deal.site?.county ?? null,
    commodity: deal.site ? COMMODITY_LABEL[deal.site.commodity] ?? deal.site.commodity : null,
    included: included.map(({ key, name, agency, status, reason, deliverables, citation }) => ({
      key,
      name,
      agency,
      status,
      reason,
      deliverables,
      citation,
    })),
    optional: optional.map(({ key, name, reason }) => ({ key, name, reason })),
    alsoIncluded: [
      "Regulatory screening of the site against county, WDNR, EPA and MSHA requirements (items marked 'confirm' are resolved in this step and dropped if not needed)",
      "One point of contact for every agency: we file, answer comments and chase decisions",
      "Online client intake — no forms for you to fill out twice",
      "12-month compliance calendar with reminders for annual reports, fees, inspections and training",
    ],
    timelineWeeks: estimateTimelineWeeks(needs),
    exclusions: EXCLUSIONS,
    paymentTerms:
      deposit > 0 && deposit < 100
        ? `${deposit}% (${usd((pricing.price * deposit) / 100)}) on signing to start work; ${100 - deposit}% (${usd(
            (pricing.price * (100 - deposit)) / 100,
          )}) when the applications are filed.`
        : `${usd(pricing.price)} on signing.`,
    retainer: {
      monthly: pricing.retainerMonthly,
      description:
        "Optional after approval: we run the compliance calendar — annual reclamation report and fee, storm water inspections and eDMRs, air records, MSHA quarterly reports — month to month, cancel anytime.",
    },
  };
}

export async function createProposal(dealId: string) {
  const existing = await db.proposal.findUnique({ where: { dealId } });
  if (existing && ["SENT", "VIEWED", "ACCEPTED"].includes(existing.status)) return existing;
  const s = await getSettings();
  const deal = await db.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: { company: true, site: true },
  });
  const signals = await db.signal.findMany({
    where: { OR: [{ siteId: deal.siteId ?? "__none__" }, { companyId: deal.companyId, siteId: null }] },
    select: { type: true, detectedAt: true },
  });
  const priced = await repriceDeal(dealId, s);
  const retainerMonthly = priced.retainerMonthly ?? s.retainerMonthly;
  const scope = buildScope(s, deal, signalFlags(signals), { price: priced.value, retainerMonthly });
  const data = {
    price: priced.value,
    retainerMonthly,
    pricingTier: priced.pricingTier,
    customNote: existing?.customNote ?? null,
    depositPct: s.depositPct,
    scope: scope as unknown as Prisma.InputJsonValue,
    expiresAt: new Date(Date.now() + s.proposalValidDays * 86_400_000),
    status: "DRAFT",
  };
  const proposal = existing
    ? await db.proposal.update({ where: { id: existing.id }, data })
    : await db.proposal.create({ data: { ...data, dealId, token: randomToken() } });
  await logDealEvent(dealId, "PROPOSAL_CREATED", `${usd(priced.value)} (${priced.pricingTier ?? "custom"}), ${scope.included.length} permits in scope`);
  return proposal;
}

export const proposalUrl = (token: string) => `${appUrl()}/p/${token}`;

export async function sendProposal(
  proposalId: string,
  opts: { viaReplyTo?: { inboundId: string; subject: string; inReplyTo?: string } } = {},
) {
  const s = await getSettings();
  const p = await db.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { deal: { include: { company: true, site: true } } },
  });
  const contact = p.deal.primaryContactId ? await db.contact.findUnique({ where: { id: p.deal.primaryContactId } }) : null;
  if (!contact?.email) throw new Error("Deal has no primary contact email");
  const scope = p.scope as unknown as ProposalScope;
  const lastOut = await db.message.findFirst({
    where: { contactId: contact.id, direction: "OUT", status: "SENT" },
    orderBy: { createdAt: "desc" },
  });
  const from = lastOut?.fromEmail || s.fromEmail;
  const subject = opts.viaReplyTo
    ? `Re: ${opts.viaReplyTo.subject.replace(/^Re:\s*/i, "")}`
    : `Proposal: ${scope.siteName ?? scope.clientName} permitting`;
  const body = [
    `Hi ${contact.firstName ?? "there"},`,
    `Here's the proposal for ${scope.siteName ?? scope.clientName}${scope.county ? ` (${scope.county} County)` : ""}:`,
    proposalUrl(p.token),
    `In short: a flat ${usd(p.price)} covers ${scope.included
      .slice(0, 4)
      .map((i) => i.name.split(" (")[0].toLowerCase())
      .join(", ")}${scope.included.length > 4 ? " and the rest of the list" : ""} — we draft, file and see each one through to a decision. Typical timeline is ${scope.timelineWeeks[0]}–${scope.timelineWeeks[1]} weeks, running in parallel.`,
    `You can review and accept online; ${scope.paymentTerms.split(";")[0].toLowerCase()}. Happy to walk through it on a call first if that's easier${s.bookingUrl ? `: ${s.bookingUrl}` : "."}`,
  ].join("\n\n");
  const text = composeBody(body, s, contact.email, { withFooter: !opts.viaReplyTo });
  const res = await sendMail(
    {
      from,
      fromName: s.senderName,
      to: contact.email,
      subject,
      text,
      replyTo: s.replyToEmail || undefined,
      inReplyTo: opts.viaReplyTo?.inReplyTo ?? null,
      references: opts.viaReplyTo?.inReplyTo ? [opts.viaReplyTo.inReplyTo] : undefined,
    },
    from,
  );
  await db.message.create({
    data: {
      direction: "OUT",
      contactId: contact.id,
      dealId: p.dealId,
      fromEmail: res.mailbox,
      toEmail: contact.email,
      subject,
      body: text,
      status: "SENT",
      providerId: res.messageId,
      inReplyTo: opts.viaReplyTo?.inReplyTo,
      generatedBy: "template",
      sentAt: new Date(),
    },
  });
  await db.proposal.update({ where: { id: p.id }, data: { status: p.status === "VIEWED" ? "VIEWED" : "SENT", sentAt: new Date() } });
  const deal = await db.deal.findUniqueOrThrow({ where: { id: p.dealId } });
  if (!["PROPOSAL", "WON", "LOST"].includes(deal.stage)) {
    await db.deal.update({ where: { id: p.dealId }, data: { stage: "PROPOSAL" } });
    await logDealEvent(p.dealId, "STAGE", `${deal.stage} → PROPOSAL`);
  }
  await logDealEvent(p.dealId, "PROPOSAL_SENT", contact.email);
}

export async function markViewed(token: string) {
  const p = await db.proposal.findUnique({ where: { token } });
  if (!p || p.viewedAt || !["SENT", "DRAFT"].includes(p.status)) return;
  await db.proposal.update({ where: { id: p.id }, data: { status: "VIEWED", viewedAt: new Date() } });
  await logDealEvent(p.dealId, "PROPOSAL_VIEWED");
}

export async function acceptProposal(
  token: string,
  signer: { name: string; title: string; email: string; ip: string | null },
): Promise<{ dealId: string; projectId: string }> {
  const p = await db.proposal.findUnique({ where: { token } });
  if (!p) throw new Error("Proposal not found");
  if (p.status === "ACCEPTED") {
    const project = await db.project.findUnique({ where: { dealId: p.dealId } });
    return { dealId: p.dealId, projectId: project?.id ?? "" };
  }
  if (p.expiresAt < new Date() || p.status === "EXPIRED") throw new Error("This proposal has expired — reply to the email and we'll reissue it.");
  if (p.status === "DECLINED") throw new Error("This proposal was declined.");
  await db.proposal.update({
    where: { id: p.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      signerName: signer.name,
      signerTitle: signer.title,
      signerEmail: signer.email.toLowerCase(),
      signerIp: signer.ip,
    },
  });
  await db.deal.update({ where: { id: p.dealId }, data: { stage: "WON", wonAt: new Date(), value: p.price } });
  await logDealEvent(p.dealId, "WON", `Signed by ${signer.name} (${signer.title}) <${signer.email}>`);
  const { createProjectForDeal } = await import("./delivery");
  const project = await createProjectForDeal(p.dealId);
  const { notifyOwner } = await import("./outreach/replies");
  const deal = await db.deal.findUniqueOrThrow({ where: { id: p.dealId }, include: { company: true } });
  await notifyOwner(
    `✅ Signed: ${deal.company.name} — ${usd(p.price)}`,
    `${signer.name} (${signer.title}) accepted the proposal.\nIntake link sent automatically.\n\n${appUrl()}/deals/${p.dealId}`,
  );
  return { dealId: p.dealId, projectId: project.id };
}

export async function declineProposal(token: string, reason: string) {
  const p = await db.proposal.findUnique({ where: { token } });
  if (!p || p.status === "ACCEPTED") return;
  await db.proposal.update({ where: { id: p.id }, data: { status: "DECLINED", declinedAt: new Date() } });
  await db.deal.update({ where: { id: p.dealId }, data: { stage: "LOST", lostReason: reason || "Declined proposal" } });
  await logDealEvent(p.dealId, "PROPOSAL_DECLINED", reason);
}

/** Follow up on proposals that went quiet; expire stale ones. */
export async function nudgeProposals(now = new Date()) {
  const s = await getSettings();
  const open = await db.proposal.findMany({
    where: { status: { in: ["SENT", "VIEWED"] } },
    include: { deal: { include: { company: true } } },
  });
  let nudged = 0;
  let expired = 0;
  for (const p of open) {
    if (p.expiresAt < now) {
      await db.proposal.update({ where: { id: p.id }, data: { status: "EXPIRED" } });
      await db.task.create({
        data: { type: "FOLLOW_UP", title: `Proposal expired: ${p.deal.company.name}`, detail: "Call to reissue or close out.", dealId: p.dealId },
      });
      expired++;
      continue;
    }
    if (p.nudgeCount >= 3) continue;
    const since = (p.lastNudgeAt ?? p.viewedAt ?? p.sentAt ?? p.createdAt).getTime();
    const waitDays = p.status === "SENT" ? 2 : 3;
    if (now.getTime() - since < waitDays * 86_400_000) continue;

    const contact = p.deal.primaryContactId ? await db.contact.findUnique({ where: { id: p.deal.primaryContactId } }) : null;
    if (!contact?.email || contact.doNotContact) continue;
    const first = contact.firstName ?? "there";
    const scope = p.scope as unknown as ProposalScope;
    const body =
      p.status === "SENT"
        ? `Hi ${first},\n\nMaking sure the proposal for ${scope.siteName ?? scope.clientName} reached you:\n${proposalUrl(p.token)}\n\nAny questions I can answer?`
        : p.nudgeCount === 0
          ? `Hi ${first},\n\nSaw you had a look at the proposal. Anything you'd want changed in the scope, or questions from your side before moving ahead?`
          : `Hi ${first},\n\nChecking in on the ${scope.siteName ?? "permitting"} proposal — it's good through ${p.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}. If the timing has moved, just let me know and I'll close it out.`;
    const lastOut = await db.message.findFirst({
      where: { contactId: contact.id, direction: "OUT", status: "SENT" },
      orderBy: { createdAt: "desc" },
    });
    try {
      const subject = lastOut?.subject ? `Re: ${lastOut.subject.replace(/^Re:\s*/i, "")}` : "Proposal";
      const text = composeBody(body, s, contact.email);
      const res = await sendMail(
        {
          from: lastOut?.fromEmail || s.fromEmail,
          fromName: s.senderName,
          to: contact.email,
          subject,
          text,
          inReplyTo: lastOut?.providerId,
          references: lastOut?.providerId ? [lastOut.providerId] : undefined,
          bulk: true,
        },
        lastOut?.fromEmail ?? undefined,
      );
      await db.message.create({
        data: {
          direction: "OUT",
          contactId: contact.id,
          dealId: p.dealId,
          fromEmail: res.mailbox,
          toEmail: contact.email,
          subject,
          body: text,
          status: "SENT",
          providerId: res.messageId,
          inReplyTo: lastOut?.providerId,
          generatedBy: "template",
          sentAt: new Date(),
        },
      });
      await db.proposal.update({ where: { id: p.id }, data: { lastNudgeAt: now, nudgeCount: p.nudgeCount + 1 } });
      await logDealEvent(p.dealId, "PROPOSAL_NUDGE", `#${p.nudgeCount + 1}`);
      nudged++;
    } catch (err) {
      console.error("proposal nudge failed", err);
    }
  }
  return { summary: `Proposals: ${nudged} nudged, ${expired} expired.`, nudged, expired };
}

// ---------------------------------------------------------------- Stripe deposit

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;

export type PaymentKind = "deposit" | "balance";

export function paymentAmount(p: { price: number; depositPct: number }, kind: PaymentKind) {
  const deposit = Math.round((p.price * p.depositPct) / 100);
  return kind === "deposit" ? deposit : p.price - deposit;
}

/** Stripe Checkout for the deposit (on signing) or the balance (at filing). */
export async function createCheckout(token: string, kind: PaymentKind, returnTo?: string): Promise<string | null> {
  if (!stripeEnabled()) return null;
  const p = await db.proposal.findUnique({ where: { token }, include: { deal: { include: { company: true, project: true } } } });
  if (!p || p.status !== "ACCEPTED") return null;
  if (kind === "deposit" && (p.depositPaidAt || p.depositPct <= 0)) return null;
  if (kind === "balance" && (p.balancePaidAt || p.depositPct >= 100)) return null;
  const amount = paymentAmount(p, kind);
  if (amount <= 0) return null;
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const scope = p.scope as unknown as ProposalScope;
  const back = returnTo ?? `${appUrl()}/p/${token}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: p.signerEmail ?? undefined,
    // ACH is the norm for $20k B2B payments; cards stay available.
    payment_method_types: ["us_bank_account", "card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount * 100,
          product_data: {
            name: `${scope.packageName} — ${kind === "deposit" ? `${p.depositPct}% deposit` : "balance due at filing"}`,
            description: `${scope.siteName ?? scope.clientName}${scope.county ? `, ${scope.county} County` : ""}`,
          },
        },
      },
    ],
    metadata: { proposalId: p.id, dealId: p.dealId, kind },
    success_url: `${back}${back.includes("?") ? "&" : "?"}paid=${kind}`,
    cancel_url: back,
  });
  await db.proposal.update({ where: { id: p.id }, data: { stripeSessionId: session.id } });
  return session.url;
}

export const createDepositCheckout = (token: string) => createCheckout(token, "deposit");

export async function markBalancePaid(proposalId: string) {
  const p = await db.proposal.findUnique({ where: { id: proposalId } });
  if (!p || p.balancePaidAt) return;
  await db.proposal.update({ where: { id: p.id }, data: { balancePaidAt: new Date() } });
  await logDealEvent(p.dealId, "BALANCE_PAID", usd(paymentAmount(p, "balance")));
}

export async function markDepositPaid(proposalId: string) {
  const p = await db.proposal.findUnique({ where: { id: proposalId } });
  if (!p || p.depositPaidAt) return;
  await db.proposal.update({ where: { id: p.id }, data: { depositPaidAt: new Date() } });
  await logDealEvent(p.dealId, "DEPOSIT_PAID", usd((p.price * p.depositPct) / 100));
}
