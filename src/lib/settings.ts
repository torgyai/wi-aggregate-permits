import { z } from "zod";
import { db } from "./db";

/**
 * Operator-editable settings (Settings page). Stored as one JSON row so a
 * new field only needs a default here.
 */
export const SettingsSchema = z.object({
  // Master switch: when off, cron ticks only sync + score; nothing is sent.
  autopilot: z.boolean().default(false),
  // review: AI-drafted replies wait for approval. autopilot: confident replies send themselves.
  replyMode: z.enum(["review", "autopilot"]).default("review"),
  replyAutoSendConfidence: z.number().min(0).max(1).default(0.85),

  // Outreach volume + targeting
  minScoreToEnroll: z.number().int().min(0).max(100).default(55),
  dailyNewEnrollments: z.number().int().min(0).max(500).default(20),
  dailySendCapPerMailbox: z.number().int().min(1).max(500).default(40),
  maxSendsPerTick: z.number().int().min(1).max(100).default(8),
  sendWindowStartHour: z.number().int().min(0).max(23).default(8),
  sendWindowEndHour: z.number().int().min(1).max(24).default(16),
  sendDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  manualStepsAsTasks: z.boolean().default(true),

  // Identity (CAN-SPAM requires a valid physical postal address in every commercial email)
  companyName: z.string().default("Stratex"),
  senderName: z.string().default("Christian"),
  senderTitle: z.string().default("Permitting Lead"),
  fromEmail: z.string().default(""),
  replyToEmail: z.string().default(""),
  notifyEmail: z.string().default(""),
  physicalAddress: z.string().default(""),
  phone: z.string().default(""),
  bookingUrl: z.string().default(""),
  website: z.string().default(""),

  // Offer
  packageName: z.string().default("Wisconsin Pit & Quarry Permit Package"),
  packagePrice: z.number().min(0).default(40000),
  depositPct: z.number().int().min(0).max(100).default(50),
  retainerMonthly: z.number().min(0).default(1500),
  proposalValidDays: z.number().int().min(1).max(365).default(30),
  autoSendProposalOnRequest: z.boolean().default(true),

  // Enrichment
  apolloRevealEmails: z.boolean().default(false),
  apolloDailyRevealCap: z.number().int().min(0).max(1000).default(25),
});

export type Settings = z.infer<typeof SettingsSchema>;

const KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  let raw: unknown = {};
  if (row) {
    try {
      raw = JSON.parse(row.value);
    } catch {
      raw = {};
    }
  }
  const parsed = SettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : SettingsSchema.parse({});
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = SettingsSchema.parse({ ...current, ...patch });
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

/** Things that must be set before autopilot is allowed to send anything. */
export function sendingBlockers(s: Settings): string[] {
  const out: string[] = [];
  if (!s.physicalAddress.trim()) out.push("Physical mailing address (required by CAN-SPAM)");
  if (!s.fromEmail.trim() && !process.env.SMTP_USER && !process.env.SMTP_MAILBOXES) out.push("From email / mailbox");
  const live = (process.env.LIVE_SEND ?? "").toLowerCase() === "on" && ["smtp", "resend"].includes((process.env.MAIL_TRANSPORT ?? "").toLowerCase());
  if (!live) out.push("Safe mode: LIVE_SEND is not 'on' (dry run: emails are recorded, nothing is sent)");
  return out;
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
