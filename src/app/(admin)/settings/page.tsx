import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { aiEnabled, aiModel } from "@/lib/ai";
import { apolloEnabled } from "@/lib/apollo";
import { imapEnabled } from "@/lib/outreach/imap";
import { mailboxes, transportName } from "@/lib/outreach/mailer";
import { stripeEnabled } from "@/lib/proposals";
import { getSettings, sendingBlockers, type Settings } from "@/lib/settings";
import { updateSettings } from "../../actions";

export const dynamic = "force-dynamic";

function Field({ name, label, s, type = "text", hint, step }: { name: keyof Settings; label: string; s: Settings; type?: string; hint?: string; step?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={type} step={step} defaultValue={String(s[name] ?? "")} />
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({ name, label, s, hint }: { name: keyof Settings; label: string; s: Settings; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={Boolean(s[name])} className="mt-0.5" />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SettingsPage() {
  const s = await getSettings();
  const blockers = sendingBlockers(s);
  const env = [
    ["Mail transport", transportName() === "smtp" ? `smtp (${mailboxes().length} mailbox${mailboxes().length === 1 ? "" : "es"})` : transportName()],
    ["Claude", aiEnabled() ? aiModel() : "not configured — templates"],
    ["Reply inbox (IMAP)", imapEnabled() ? "configured" : "not configured"],
    ["Apollo", apolloEnabled() ? "configured" : "not configured"],
    ["Stripe deposits", stripeEnabled() ? "configured" : "not configured — proposals still accept signatures"],
  ];
  return (
    <>
      <PageHeader title="Settings" />
      {blockers.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <strong>Before live sending:</strong>
          <ul className="ml-5 list-disc">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}
      <form action={updateSettings} className="space-y-6">
        <Card title="Autopilot">
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle name="autopilot" label="Autopilot on" s={s} hint="Enroll new leads, send sequences, nudge proposals, remind clients. Off = only replies and drafts run." />
            <div>
              <label className="label">Reply mode</label>
              <select className="input" name="replyMode" defaultValue={s.replyMode}>
                <option value="review">Review — every drafted reply waits for my approval</option>
                <option value="autopilot">Autopilot — confident replies send themselves</option>
              </select>
            </div>
            <Field name="replyAutoSendConfidence" label="Auto-send confidence (0–1)" type="number" step="0.05" s={s} />
            <Toggle name="autoSendProposalOnRequest" label="Send the proposal automatically when a lead asks for pricing" s={s} />
            <Toggle name="manualStepsAsTasks" label="Create call / LinkedIn tasks between emails" s={s} />
          </div>
        </Card>

        <Card title="Volume & timing">
          <div className="grid gap-4 md:grid-cols-3">
            <Field name="minScoreToEnroll" label="Minimum lead score" type="number" s={s} />
            <Field name="dailyNewEnrollments" label="New leads per day" type="number" s={s} />
            <Field name="dailySendCapPerMailbox" label="Emails per mailbox per day" type="number" s={s} hint="Keep ≤ 40 on new domains; warm up first." />
            <Field name="maxSendsPerTick" label="Emails per 15-min run" type="number" s={s} />
            <Field name="sendWindowStartHour" label="Send window start (Central)" type="number" s={s} />
            <Field name="sendWindowEndHour" label="Send window end (Central)" type="number" s={s} />
            <div className="md:col-span-3">
              <label className="label">Send days</label>
              <div className="flex gap-3 text-sm">
                {DAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1">
                    <input type="checkbox" name="sendDays" value={i} defaultChecked={s.sendDays.includes(i)} /> {d}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Sender identity">
          <div className="grid gap-4 md:grid-cols-3">
            <Field name="companyName" label="Company" s={s} />
            <Field name="senderName" label="Sender name" s={s} />
            <Field name="senderTitle" label="Sender title" s={s} />
            <Field name="fromEmail" label="From email" type="email" s={s} hint="Use a separate outreach domain, not your main one." />
            <Field name="replyToEmail" label="Reply-to (optional)" type="email" s={s} />
            <Field name="notifyEmail" label="Notify me at" type="email" s={s} hint="Hot replies, signatures, drafts ready." />
            <Field name="phone" label="Phone" s={s} />
            <Field name="bookingUrl" label="Booking link" s={s} hint="Calendly / Cal.com — used in replies." />
            <Field name="website" label="Website" s={s} />
            <div className="md:col-span-3">
              <Field name="physicalAddress" label="Physical mailing address (CAN-SPAM, required)" s={s} />
            </div>
          </div>
        </Card>

        <Card title="Offer">
          <div className="grid gap-4 md:grid-cols-3">
            <Field name="packageName" label="Package name" s={s} />
            <Field name="packagePrice" label="Package price (USD)" type="number" s={s} />
            <Field name="depositPct" label="Deposit %" type="number" s={s} />
            <Field name="retainerMonthly" label="Compliance plan $/month" type="number" s={s} />
            <Field name="proposalValidDays" label="Proposal valid (days)" type="number" s={s} />
          </div>
        </Card>

        <Card title="Enrichment">
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle name="apolloRevealEmails" label="Reveal emails with Apollo (uses credits)" s={s} />
            <Field name="apolloDailyRevealCap" label="Max reveals per day" type="number" s={s} />
          </div>
        </Card>

        <div className="flex justify-end">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </form>

      <Card title="Environment" className="mt-6">
        <dl className="grid gap-y-1 text-sm md:grid-cols-[200px_1fr]">
          {env.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">Credentials are environment variables (see .env.example) — never stored in the database.</p>
      </Card>
    </>
  );
}
