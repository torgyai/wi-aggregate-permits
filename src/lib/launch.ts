/**
 * Launch checklist: every manual step between "code deployed" and "autopilot
 * closing deals", with automatic detection where the app can see the answer.
 */
import { aiEnabled } from "./ai";
import { apolloEnabled } from "./apollo";
import { db } from "./db";
import { imapEnabled } from "./outreach/imap";
import { liveSendEnabled, mailboxes } from "./outreach/mailer";
import { stripeEnabled } from "./proposals";
import { getSettings } from "./settings";

export type CheckStatus = "done" | "todo" | "manual" | "optional";
export type CheckItem = { id: string; title: string; detail: string; status: CheckStatus; where?: string; owner: "you" | "app" };
export type CheckGroup = { title: string; why: string; items: CheckItem[] };

export async function launchChecklist(): Promise<CheckGroup[]> {
  const s = await getSettings();
  const [sites, mshaRuns, wdnrRuns, contacts, targets, sentDry, projects] = await Promise.all([
    db.site.count({ where: { mshaMineId: { not: null } } }),
    db.jobRun.count({ where: { job: "msha", ok: true } }),
    db.jobRun.count({ where: { job: "wdnr", ok: true } }),
    db.contact.count({ where: { email: { not: null } } }),
    db.company.count({ where: { isTargetAccount: true } }),
    db.message.count({ where: { direction: "OUT", status: "SENT" } }),
    db.project.count(),
  ]);
  const env = (k: string) => !!process.env[k];
  const st = (ok: boolean): CheckStatus => (ok ? "done" : "todo");

  return [
    {
      title: "1. Hosting & access",
      why: "The app must run 24/7 for the 15-minute autopilot.",
      items: [
        { id: "vercel", owner: "you", title: "Vercel project with Root Directory = aggregate", detail: "New project from the stratex repo; root directory `aggregate`. Pro plan is required for the 15-minute cron (Hobby only runs daily).", status: "manual" },
        { id: "db", owner: "you", title: "Postgres database (Neon / Supabase / Vercel Postgres)", detail: "Pooled connection string in DATABASE_URL, then `npx prisma db push` once.", status: st(env("DATABASE_URL")) },
        { id: "auth", owner: "you", title: "AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD", detail: "Long random secret; your login.", status: st(env("AUTH_SECRET") && env("ADMIN_PASSWORD")) },
        { id: "url", owner: "you", title: "APP_URL set to your real domain", detail: "Used in proposal, intake, portal and unsubscribe links (e.g. https://permits.yourdomain.com).", status: st(!!process.env.APP_URL && !/localhost/.test(process.env.APP_URL)) },
        { id: "cron", owner: "you", title: "CRON_SECRET", detail: "Vercel sends it to /api/cron/*; without it production cron calls are refused.", status: st(env("CRON_SECRET")) },
      ],
    },
    {
      title: "2. Business setup",
      why: "Things only you can do; the software can't sign contracts or carry insurance.",
      items: [
        { id: "entity", owner: "you", title: "Business entity + bank account for client payments", detail: "Stratex LLC (or similar) that signs the proposals.", status: "manual" },
        { id: "insurance", owner: "you", title: "Professional liability (E&O) insurance", detail: "Before the first signed client.", status: "manual" },
        { id: "partners", owner: "you", title: "Line up a PE / professional geologist and field subcontractors", detail: "For stamped drawings, hydrogeology, wetland delineation, surveying. The proposal excludes these and passes them through.", status: "manual" },
        { id: "agency-accounts", owner: "you", title: "Agency accounts", detail: "WDNR ePermitting / Switchboard login (WPDES NOI, air forms), MSHA online filing. County contacts per job.", status: "manual" },
        { id: "address", owner: "you", title: "Physical mailing address in Settings", detail: "Required by CAN-SPAM in every commercial email.", status: st(!!s.physicalAddress.trim()), where: "/settings" },
        { id: "identity", owner: "you", title: "Sender identity, phone, booking link, notify email", detail: "Settings → Sender identity. Booking link = Calendly/Cal.com 15-minute call.", status: st(!!s.bookingUrl && !!s.notifyEmail && !!s.phone), where: "/settings" },
        { id: "pricing", owner: "you", title: "Confirm pricing", detail: `Standard package ${"$" + s.packagePrice.toLocaleString()}, deposit ${s.depositPct}%. Tiers are in the Training → Pricing lesson.`, status: "manual", where: "/settings" },
      ],
    },
    {
      title: "3. Email infrastructure (the #1 reason cold outreach fails)",
      why: "Get this wrong and every email lands in spam or burns your main domain.",
      items: [
        { id: "domain", owner: "you", title: "Buy a separate outreach domain", detail: "e.g. getstratex.com. Never cold-email from your main domain.", status: "manual" },
        { id: "mailboxes", owner: "you", title: "2–3 Google Workspace mailboxes on it", detail: "Use app passwords; add them to SMTP_MAILBOXES as user:pass@smtp.gmail.com:587.", status: st(mailboxes().length >= 2) },
        { id: "dns", owner: "you", title: "SPF, DKIM, DMARC records", detail: "Set in your DNS host; verify with mail-tester.com (aim for 9+/10).", status: "manual" },
        { id: "warmup", owner: "you", title: "Warm up the mailboxes 2–3 weeks", detail: "Warm-up tool (Instantly/Smartlead/Mailreach) before any real send. Then ≤ 40 emails/mailbox/day.", status: "manual" },
        { id: "imap", owner: "you", title: "Reply inbox (IMAP) or inbound webhook", detail: "IMAP_HOST/USER/PASS so replies are read and handled automatically.", status: st(imapEnabled()) },
      ],
    },
    {
      title: "4. Data",
      why: "The autopilot can only email leads that have a decision-maker email.",
      items: [
        { id: "msha", owner: "app", title: "MSHA registry synced (every WI pit & quarry)", detail: `${sites.toLocaleString()} MSHA sites loaded. Runs weekly on its own after the first sync.`, status: st(mshaRuns > 0 && sites > 0), where: "/import" },
        { id: "wdnr", owner: "app", title: "WDNR permit applications synced", detail: "Pending WPDES nonmetallic applications as buying signals.", status: st(wdnrRuns > 0), where: "/import" },
        { id: "targets", owner: "app", title: "40 researched target accounts loaded", detail: `${targets} loaded. No contacts are added, so nothing is emailed.`, status: st(targets >= 40), where: "/accounts" },
        { id: "contacts", owner: "you", title: "Decision-maker contacts", detail: `${contacts} contacts with email. Upload an Apollo/Apify CSV or turn on Apollo enrichment. Start with the priority target accounts.`, status: st(contacts >= 25), where: "/import" },
      ],
    },
    {
      title: "5. Test in safe mode",
      why: "Run the whole machine with nothing leaving the building.",
      items: [
        { id: "safe", owner: "app", title: "Safe mode is on", detail: "LIVE_SEND is not 'on': every email is recorded in the app, none are sent.", status: liveSendEnabled() ? "todo" : "done" },
        { id: "dryrun", owner: "you", title: "Run autopilot once and read the recorded emails", detail: `${sentDry} emails recorded so far. Dashboard → Run autopilot now; open a few deals and read the timeline.`, status: st(sentDry > 0), where: "/" },
        { id: "previews", owner: "you", title: "Preview the first email for your top 20 leads", detail: "Leads → site → Preview first email. Fix site facts that look wrong.", status: "manual", where: "/sites" },
        { id: "flow", owner: "you", title: "Walk a test deal end to end", detail: "Create & send a proposal to yourself, sign it, fill the intake, generate drafts, share to the portal, approve one.", status: st(projects > 0), where: "/pipeline" },
        { id: "training", owner: "you", title: "Finish the training course", detail: "About 90 minutes.", status: "manual", where: "/training" },
      ],
    },
    {
      title: "6. Go live",
      why: "Last, and only after everything above.",
      items: [
        { id: "reply-mode", owner: "you", title: "Keep Reply mode on 'review' for the first weeks", detail: "Approve drafted replies from the Inbox until you trust them.", status: s.replyMode === "review" ? "done" : "manual", where: "/settings" },
        { id: "volume", owner: "you", title: "Start small: 10 new leads/day, 20 emails/mailbox/day", detail: `Currently ${s.dailyNewEnrollments}/day and ${s.dailySendCapPerMailbox}/mailbox.`, status: st(s.dailyNewEnrollments <= 15 && s.dailySendCapPerMailbox <= 30), where: "/settings" },
        { id: "autopilot", owner: "you", title: "Turn Autopilot on", detail: "Settings → Autopilot.", status: st(s.autopilot), where: "/settings" },
        { id: "live", owner: "you", title: "Set LIVE_SEND=on and MAIL_TRANSPORT=smtp (server env)", detail: "The switch that lets real email leave. Redeploy after setting it.", status: liveSendEnabled() ? "done" : "todo" },
      ],
    },
    {
      title: "Optional power-ups",
      why: "Everything works without these, with templates and manual steps instead.",
      items: [
        { id: "claude", owner: "you", title: "ANTHROPIC_API_KEY (Claude)", detail: "Site-specific emails, smarter reply triage and drafts, stronger permit documents. Without it: templates + keyword rules.", status: aiEnabled() ? "done" : "optional" },
        { id: "apollo", owner: "you", title: "APOLLO_API_KEY", detail: "Finds owners' emails for top leads (credits, daily cap in Settings).", status: apolloEnabled() ? "done" : "optional" },
        { id: "stripe", owner: "you", title: "Stripe keys + webhook (/api/stripe/webhook)", detail: "Deposit and balance by ACH/card. Without it: invoice and click 'Mark paid'.", status: stripeEnabled() ? "done" : "optional" },
      ],
    },
  ];
}
