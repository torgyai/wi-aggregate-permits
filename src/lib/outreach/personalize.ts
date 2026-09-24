import { z } from "zod";
import { AiUnavailable, generateJson } from "../ai";
import { usd } from "../format";
import type { LeadContext } from "./context";
import type { SequenceStep } from "./sequence";
import { templateEmail } from "./templates";

const EmailSchema = z.object({
  subject: z.string().max(80),
  body: z.string().min(20).max(1600),
});

const EMAIL_JSON_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "2-6 words, lowercase-ish, no clickbait. Empty string for threaded follow-ups." },
    body: {
      type: "string",
      description: "Plain-text email body starting with 'Hi <first name>,'. No signature, no footer, no links unless given.",
    },
  },
  required: ["subject", "body"],
  additionalProperties: false,
};

const SYSTEM = `You write short, specific cold emails for a Wisconsin environmental permitting firm that handles permits for sand & gravel pits and stone quarries (county NR 135 reclamation permits, conditional use permits, WPDES storm water coverage, air permits for crushers, high-capacity wells, SPCC, MSHA filings).

The reader runs or owns an aggregate operation: practical, busy, allergic to marketing. Write like a knowledgeable local consultant, not a salesperson.

Rules:
- 50-120 words. Plain text. Short paragraphs. No bullet lists in the first email.
- Only state facts given in the lead data. Never claim the site is out of compliance, missing a permit, under investigation, or has an expired permit — say what sites like theirs "typically" or "usually" need.
- Reference the specific site name and county, and the trigger if one is given.
- One clear ask per email. Do not include a signature, sign-off name, unsubscribe text or footer — those are appended automatically.
- No links unless a booking URL is provided AND the step is not the opener.
- No exclamation marks, no "I hope this finds you well", no "quick question", no emojis.
- Never mention AI or automation.`;

export type WrittenEmail = { subject: string; body: string; generatedBy: "ai" | "template" };

export async function writeEmail(
  ctx: LeadContext,
  step: SequenceStep,
  previous: { subject: string | null; body: string }[],
): Promise<WrittenEmail> {
  const fallback = templateEmail(ctx, step);
  const prompt = JSON.stringify(
    {
      task: `Write email for sequence step "${step.intent}".`,
      step_guidance: step.guidance,
      threaded_reply: !!step.threaded,
      lead: {
        first_name: ctx.contact.firstName,
        title: ctx.contact.title,
        company: ctx.company.name,
        wisconsin_sites_on_record: ctx.company.wiSiteCount,
        site: ctx.site,
        trigger: ctx.angle === "GENERAL" ? null : { type: ctx.angle, detail: ctx.signalSummary },
        likely_permits: ctx.needs
          .filter((n) => n.status !== "CHECK")
          .slice(0, 5)
          .map((n) => ({ permit: n.shortName, agency: n.agency, why: n.reason })),
        typical_timeline_weeks: ctx.timelineWeeks,
      },
      offer: {
        name: ctx.offer.name,
        price: step.intent === "proof" ? usd(ctx.offer.price) : "do not mention price",
        includes:
          "drafted applications and plans, county/WDNR correspondence through approval, reclamation cost estimate for the bond, SWPPP, hearing prep, 12-month compliance calendar; client reviews and signs",
      },
      sender: { first_name: ctx.sender.name, company: ctx.sender.company, booking_url: ctx.sender.bookingUrl || null },
      previous_emails_in_sequence: previous,
      style_reference: fallback,
    },
    null,
    2,
  );

  try {
    const out = await generateJson({
      system: SYSTEM,
      prompt,
      schema: EmailSchema,
      jsonSchema: EMAIL_JSON_SCHEMA,
      effort: "medium",
      maxTokens: 4000,
    });
    return { subject: step.threaded ? "" : out.subject.trim(), body: out.body.trim(), generatedBy: "ai" };
  } catch (err) {
    if (!(err instanceof AiUnavailable)) console.error("AI email failed, using template:", err);
    return { ...fallback, generatedBy: "template" };
  }
}
