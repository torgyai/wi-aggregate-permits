# What stays manual

The app automates prospecting, outreach, reply handling, proposals, e-signature, payment links, intake, permit drafts, client review, reminders and the compliance calendar. These are the things only a person can do. They also appear, with automatic detection where possible, on the in-app **Launch checklist** page (`/launch`).

## One-time setup (before any real email)

| # | Step | Why | Where |
|---|---|---|---|
| 1 | Deploy: new Vercel project, Root Directory `aggregate`, **Pro plan** | 15-minute autopilot cron | Vercel |
| 2 | Postgres + `DATABASE_URL`; run `npx prisma db push` once | Data | Neon / Supabase |
| 3 | Set `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL`, `CRON_SECRET` | Login, links, cron | Vercel env |
| 4 | Business entity, bank account | Sign proposals, receive payments | — |
| 5 | Professional liability (E&O) insurance | Before the first client | Insurer |
| 6 | PE / professional geologist partner + field subcontractors (survey, wetland delineation, hydrogeology) | Stamped documents and field studies; excluded from the fee and passed through | — |
| 7 | WDNR ePermitting/Switchboard login, MSHA online filing account | Filing | WDNR, MSHA |
| 8 | Buy a separate outreach domain; 2–3 Google Workspace mailboxes | Protect your main domain | Registrar, Google |
| 9 | SPF, DKIM, DMARC; test at mail-tester.com (9+/10) | Deliverability | DNS |
| 10 | Warm up mailboxes 2–3 weeks | Deliverability | Warm-up tool |
| 11 | `SMTP_MAILBOXES` and `IMAP_*` env vars | Sending + reading replies | Vercel env |
| 12 | Settings: physical address, sender, phone, booking link, notify email | CAN-SPAM, replies | `/settings` |
| 13 | Data: Sync MSHA, sync WDNR, load target accounts | Leads | `/import`, `/accounts` |
| 14 | Add decision-maker contacts (CSV, Apollo, or by hand) — start with the priority accounts | The autopilot only emails leads with a contact | `/import`, site pages |
| 15 | Finish the training course (~90 min) | Know the permits and the call | `/training` |
| 16 | Test in **safe mode**: run the autopilot, read recorded emails, walk one test deal end to end | Nothing leaves in safe mode | `/` |
| 17 | Start small (10 leads/day, 20 emails/mailbox/day), Reply mode = review, Autopilot on | Ramp safely | `/settings` |
| 18 | **Last:** `LIVE_SEND=on` + `MAIL_TRANSPORT=smtp`, redeploy | The only switch that sends real email | Vercel env |

Optional: `ANTHROPIC_API_KEY` (Claude writing), `APOLLO_API_KEY` (find owners' emails), Stripe keys + webhook (ACH/card payments).

## Every day (≈20 minutes)
1. Dashboard: autopilot log green?
2. **Inbox:** approve or edit drafted replies (review mode).
3. **Tasks:** calls, LinkedIn touches, meetings.
4. **The sales call** (15 min) with anyone who booked. Script in Training → "The 15-minute call".
5. After the call: set the stage, adjust price if needed, **Create & send proposal**.

## Per signed client
1. Kickoff call (task created automatically).
2. If the client didn't fill the intake after 3 reminders: fill it together by phone.
3. Review each generated draft; fix facts; resolve **CONFIRM** items with the client; **Regenerate** if needed.
4. Get stamps from your PE/PG partner where required; order field studies if in scope.
5. **Share drafts with client** → they approve on the portal.
6. **File** each approved permit with the agency (table in Training → "From signature to permits in hand") and set its status: Submitted → Agency review → Approved.
7. Answer agency comments; attend the county hearing for conditional use permits.
8. Without Stripe: invoice deposit/balance and click **Mark paid**.
9. If they start the compliance plan: set up the monthly billing (task created).

## Every week / month
- Check MSHA/WDNR syncs ran (Data page); skim new signals.
- Spot-check the top leads and email previews.
- Move permit statuses; chase agency decisions.
- Compliance-plan clients: do what's due on each calendar and click **Done** (the next occurrence schedules itself).
- Confirm items marked *verify* in the permit rules against the county ordinance before relying on a date or fee.
