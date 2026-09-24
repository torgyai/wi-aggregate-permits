import { z } from "zod";
import { AiUnavailable, generateJson } from "../ai";
import { REPLY_CLASSES, type ReplyClass } from "../enums";

export type Classification = {
  classification: ReplyClass;
  confidence: number;
  summary: string;
  followUpDays: number | null;
  returnDate: string | null;
  referralEmail: string | null;
  referralName: string | null;
};

const Schema = z.object({
  classification: z.enum(REPLY_CLASSES),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  followUpDays: z.number().int().nullable(),
  returnDate: z.string().nullable(),
  referralEmail: z.string().nullable(),
  referralName: z.string().nullable(),
});

const JSON_SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", enum: [...REPLY_CLASSES] },
    confidence: { type: "number", description: "0-1" },
    summary: { type: "string", description: "One sentence: what they said and what they want." },
    followUpDays: {
      type: ["integer", "null"],
      description: "For NOT_NOW: days until a good time to follow up (e.g. 'after the season' in October ≈ 150). Else null.",
    },
    returnDate: { type: ["string", "null"], description: "For OUT_OF_OFFICE: ISO date they return, if stated." },
    referralEmail: { type: ["string", "null"], description: "For REFERRAL: the email of the person they pointed to." },
    referralName: { type: ["string", "null"] },
  },
  required: ["classification", "confidence", "summary", "followUpDays", "returnDate", "referralEmail", "referralName"],
  additionalProperties: false,
};

const SYSTEM = `You triage replies to cold emails from a Wisconsin permitting firm that sells a fixed-fee permitting package to sand & gravel pit and quarry operators.

Classes:
- INTERESTED: positive, open to talking, but no specific ask
- MEETING_REQUEST: wants to talk / proposes a time / asks to call
- PROPOSAL_REQUEST: asks for pricing, a quote, a proposal, or "send me something"
- QUESTION: asks a substantive question before deciding
- NOT_NOW: timing is wrong but not a no ("after the season", "next year", "busy right now")
- NOT_INTERESTED: clear no, already has a consultant, handles it in-house
- UNSUBSCRIBE: asks to stop / remove / take off list, or is hostile
- OUT_OF_OFFICE: auto-reply away message
- REFERRAL: points to someone else to talk to
- BOUNCE: delivery failure notice
- OTHER: anything else

When in doubt between UNSUBSCRIBE and NOT_INTERESTED, choose UNSUBSCRIBE. Quote nothing; summarize.`;

/** Keyword fallback when Claude isn't available. Conservative: unsure → OTHER (a human looks). */
export function heuristicClassify(subject: string, text: string, from = ""): Classification {
  const body = `${subject}\n${text}`.toLowerCase();
  const base = { followUpDays: null, returnDate: null, referralEmail: null, referralName: null };
  const hit = (re: RegExp) => re.test(body);
  const make = (classification: ReplyClass, confidence: number, summary: string): Classification => ({
    ...base,
    classification,
    confidence,
    summary,
  });

  if (/mailer-daemon|postmaster/i.test(from) || hit(/undeliverable|delivery (status notification|has failed)|address not found|mailbox unavailable/))
    return make("BOUNCE", 0.95, "Delivery failure.");
  if (hit(/out of (the )?office|on vacation|away from (my|the) (desk|office)|auto(matic)? ?reply|limited access to email/))
    return make("OUT_OF_OFFICE", 0.8, "Auto-reply: away.");
  if (hit(/unsubscribe|remove me|take me off|stop (emailing|sending)|do not (contact|email)|opt.?out/))
    return make("UNSUBSCRIBE", 0.9, "Asked to be removed.");
  if (hit(/not interested|no thanks|no thank you|we('re| are) (all )?set|already (have|use|work with)|handle (it|this) (in.?house|ourselves)/))
    return make("NOT_INTERESTED", 0.75, "Declined.");
  if (hit(/(price|pricing|quote|proposal|cost|how much)/)) return make("PROPOSAL_REQUEST", 0.6, "Asked about pricing.");
  if (hit(/(call me|give me a call|let'?s (talk|chat|meet)|set up a (call|time|meeting)|available (on|at|this|next))/))
    return make("MEETING_REQUEST", 0.65, "Wants to talk.");
  const refEmail = /(talk|speak|reach out|contact) (to|with) [^@\n]{0,60}?([\w.+-]+@[\w-]+\.[\w.-]+)/.exec(body);
  if (refEmail) return { ...make("REFERRAL", 0.6, "Pointed to someone else."), referralEmail: refEmail[2] };
  if (hit(/(next (year|spring|season)|after (the )?(season|harvest|winter)|not (right )?now|busy (right )?now|reach out (again )?in)/))
    return { ...make("NOT_NOW", 0.6, "Timing isn't right."), followUpDays: 120 };
  if (hit(/interested|sounds good|tell me more|more info/)) return make("INTERESTED", 0.6, "Positive reply.");
  if (body.includes("?")) return make("QUESTION", 0.5, "Asked a question.");
  return make("OTHER", 0.3, "Unclassified reply.");
}

export async function classifyReply(subject: string, text: string, from: string): Promise<Classification & { by: "ai" | "rules" }> {
  try {
    const out = await generateJson({
      system: SYSTEM,
      prompt: JSON.stringify({ from, subject, body: text.slice(0, 6000) }),
      schema: Schema,
      jsonSchema: JSON_SCHEMA,
      effort: "low",
      maxTokens: 2000,
    });
    return { ...out, by: "ai" };
  } catch (err) {
    if (!(err instanceof AiUnavailable)) console.error("AI classify failed, using rules:", err);
    return { ...heuristicClassify(subject, text, from), by: "rules" };
  }
}

/** Strip quoted history and signatures so classification sees only the new text. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .{5,200}wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^From: .+/i.test(line)) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}
