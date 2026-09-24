/**
 * The autopilot tick (Vercel Cron, every 15 minutes). Each stage is isolated so
 * one failure (a flaky IMAP server, an API timeout) doesn't stop the rest.
 *
 *   replies  -> read inbox, classify, act
 *   enroll   -> start today's best new leads
 *   send     -> due sequence steps (send window + mailbox caps)
 *   close    -> proposal nudges / expiry
 *   deliver  -> intake reminders, permit drafts, compliance reminders
 *   enrich   -> Apollo lookups for top leads without a contact (once a day)
 */
import { db } from "./db";
import { depositReminders, generatePendingDocs, intakeReminders, obligationSweep } from "./delivery";
import { runJob } from "./jobs";
import { enrollNewLeads, processDueEnrollments } from "./outreach/engine";
import { pollImap } from "./outreach/imap";
import { liveSendEnabled } from "./outreach/mailer";
import { enrichTopCompanies } from "./prospecting";
import { nudgeProposals } from "./proposals";
import { getSettings, sendingBlockers } from "./settings";

type Stage = { name: string; run: () => Promise<{ summary: string }> };

export async function tick(now = new Date()) {
  const s = await getSettings();
  const blockers = sendingBlockers(s);
  // In safe mode (dry run) the full workflow runs so it can be tested; live mode needs every blocker cleared.
  const canSend = s.autopilot && (!liveSendEnabled() || blockers.length === 0);

  const stages: Stage[] = [
    { name: "replies", run: () => pollImap() },
    { name: "docs", run: () => generatePendingDocs(2) },
  ];
  if (canSend) {
    stages.push(
      { name: "enroll", run: () => enrollNewLeads(now, s) },
      { name: "send", run: () => processDueEnrollments(now, s) },
      { name: "proposals", run: () => nudgeProposals(now) },
      { name: "intake", run: () => intakeReminders(now) },
      { name: "deposits", run: () => depositReminders(now) },
      { name: "compliance", run: () => obligationSweep(now) },
    );
  }
  // Apollo once a day (first tick after 6am UTC with no enrichment run today).
  const lastEnrich = await db.jobRun.findFirst({ where: { job: "enrich" }, orderBy: { startedAt: "desc" } });
  if (s.autopilot && (!lastEnrich || now.getTime() - lastEnrich.startedAt.getTime() > 20 * 3_600_000)) {
    stages.push({ name: "enrich", run: () => enrichTopCompanies(15) });
  }

  const results: Record<string, string> = {};
  for (const st of stages) {
    try {
      results[st.name] = (await runJob(st.name, st.run)).summary;
    } catch (err) {
      results[st.name] = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  if (!s.autopilot) results.autopilot = "OFF — only replies and drafts run. Turn it on in Settings.";
  else if (!canSend) results.autopilot = `Sending blocked: ${blockers.join("; ")}`;
  return results;
}
