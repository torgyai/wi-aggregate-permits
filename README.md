# Stratex Aggregate: Wisconsin pit & quarry permitting autopilot

This app finds Wisconsin sand & gravel pits and stone quarries that need permits and emails their owners. It answers their replies and sends a proposal for a flat **$40,000 permit package**, which clients sign online. Once a client signs, it collects the site details and drafts every permit application. A person only takes the sales calls, approves anything the AI isn't sure about, and files the finished applications with the agencies.

```
 MSHA mine registry ─┐                       ┌─ reply: "send pricing" ──► proposal auto-sent
 WDNR WPDES apps ────┼─► score ─► enroll ─► 5-email sequence ─┤─ reply: "let's talk" ──► booking link + task
 CSV / Apollo ───────┘   (0-100)  (daily cap)  (AI-written)   ├─ "not now" / OOO / unsub / bounce ──► handled
                                                              └─ question ──► AI draft → approve (or auto)
 proposal page ─► e-sign ─► Stripe deposit ─► intake form ─► permit list re-assessed on real data
      ─► permit drafts (Claude) ─► you review & file ─► compliance calendar + client reminders ─► $/mo plan
```

## What's new in v2
- **Safe mode lock:** no email can leave unless `LIVE_SEND=on` *and* `MAIL_TRANSPORT=smtp|resend`. Everything is still written and recorded so the whole flow can be tested. The top bar always shows the mode.
- **Pricing engine:** each site gets a tier and price (T1 tune-up $15–25k · T2 standard pit $40k · T3 quarry $55–75k · T4 multi-site / industrial sand $90–150k) plus a monthly compliance plan, with reasons. You can override it per deal.
- **40 researched target accounts** with fit, trigger, scope, price and outreach angle (`/accounts`, `docs/target-accounts.md`). Loading them adds no contacts, so nothing is emailed.
- **Client portal** (`/c/<token>`) shows project progress, drafts to read and approve or comment on, the compliance calendar, a one-click compliance plan and the balance payment.
- **Deal controls:** price override, pause/resume outreach, exclude company, compose a one-off email.
- **Payments:** deposit and balance through Stripe (ACH/card), or **Mark paid**, with deposit reminders.
- **Training course** (`/training`, 13 lessons) and **Launch checklist** (`/launch`). The full list of manual steps is in `docs/manual-steps.md`.
- New UI.

## How it works

### 1. Finding leads (automatic, weekly)
- **MSHA Mines dataset:** every U.S. mine, filtered to Wisconsin aggregate sites by canvass code (5 = sand & gravel, 6 = stone, plus industrial sand under 7). Each record includes the operator, the parent company, the status, the county and the coordinates. The weekly re-sync compares against the last import and turns what changed into **signals**:
  - new mine registered
  - operator or controller change (every permit must transfer: NR 135.28, WPDES, air, MSHA legal ID)
  - idle site back to active
- **WDNR storm water permit map service:** pending applications for coverage under the nonmetallic mining WPDES general permit. An operator who files one is permitting right now.
- **Contacts:** upload a CSV from Apollo, Apify or any other export; the columns are detected automatically. Or turn on Apollo enrichment, which looks for the owner, president or GM of the highest-scoring operators, with a daily cap on credit use.
- **Scoring (0–100, every point explained):**
  - commodity
  - life-cycle stage (new mine, active, reactivated)
  - fresh signals
  - independent vs. national producer (nationals have in-house permitting teams)
  - size
  - portable plant
  - whether you have a contact

### 2. Outreach (automatic, every 15 min, weekdays 8–4 Central)
- Each day the app enrolls the best new leads: one decision maker per operator, never anyone suppressed or already worked. The daily cap is a setting.
- The sequence is 5 emails over about 3 weeks, with optional call and LinkedIn tasks in between (`src/lib/outreach/sequence.ts`).
- **Claude** writes each email from site facts only: the site name, county, trigger, and the permits it likely needs. It is told never to claim a site is out of compliance. Without an API key the app uses the built-in templates (`templates.ts`).
- Delivery details:
  - plain text, no tracking pixels
  - send window and per-mailbox daily caps
  - rotation across several mailboxes
  - follow-ups threaded in the same conversation
- **CAN-SPAM:** every email carries your physical address and an unsubscribe link, plus RFC 8058 one-click `List-Unsubscribe` headers.

### 3. Replies (automatic)
Replies come in over IMAP polling or the `/api/inbound/email` webhook. They are matched to the lead by thread headers, then by sender. Each reply is classified by Claude, or by keyword rules without a key, and then:

| Reply | What happens |
|---|---|
| Wants pricing / proposal | Proposal generated and sent in-thread; you get notified |
| Interested / wants a call | Replies with your booking link; creates a meeting task; notifies you |
| Question | AI drafts an answer from the site's permit profile; waits for your approval (or sends if confident + autopilot) |
| Not now | Acknowledges, schedules a re-engage task at the date they implied |
| Referral | Adds the referred person as a contact, thanks them |
| Not interested | Stops, deal lost |
| Unsubscribe | Suppressed forever, deal lost |
| Out of office | Pauses the sequence until they're back |
| Bounce | Suppressed, contact marked bounced |

### 4. Closing
- **Proposals** are built from the permit engine: the approvals in scope with agency, citation, reason and deliverables, plus timeline, exclusions and payment terms. Each one is published at an unguessable link.
- The client signs online by typing their name, title and email; the signature is stored with a timestamp and IP. If Stripe is configured, the client then pays the deposit through Checkout (ACH or card).
- Unviewed or unsigned proposals get up to 3 follow-ups, and they expire after 30 days (configurable).

### 5. Delivery: what the $40k buys
- Signing a proposal creates a project, emails the client an **intake questionnaire**, and sends up to 3 reminders.
- The intake answers re-run the permit assessment on real data: acres, dewatering pump size, wells, crusher throughput, fuel storage, wetlands, blasting and project type.
- The cron then generates **a working draft per permit**: reclamation plan outline, financial-assurance cost estimate, SWPPP outline, air permit applicability, CUP operations plan, high-cap well capacity check, SPCC applicability, and so on.
  - Unknowns are marked `[CONFIRM: …]`, never invented.
  - Claude improves the drafts when a key is set.
- You review the drafts, set each permit's status (ready to file, filed, agency review, approved) and file. The project status follows the permits.
- A **compliance calendar** is built from the permits in scope, and the client is reminded 14 days before each due date. That is the upsell to the monthly compliance plan. Items include:
  - NR 135 annual report and fee (Jan 31)
  - WPDES quarterly inspections and eDMRs, and the annual report (Feb 15)
  - air certifications
  - MSHA 7000-2 quarterly report and Part 46 refresher training
  - SPCC 5-year review

### What stays human
- The sales call.
- Approving replies the AI isn't sure about. Set Reply mode to autopilot to cut this down.
- Resolving `[CONFIRM]` items with the client, signing as the preparer where a PE or geologist is required, and submitting to the agency portals.

## Setup

```bash
cd aggregate
cp .env.example .env            # fill in DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL/PASSWORD, APP_URL
npm install
npm run db:push
npm run msha:sync               # loads every WI pit & quarry (or use the Data page)
npm run dev                     # http://localhost:3100
```

Optional demo data (fictional operators, `example.com` emails): `npm run db:seed`.

Tests: `npm test` (permit rules, obligations, MSHA parser, scoring, send-window/DST math, WDNR matching, CSV).

## Deploy (Vercel)

1. Create a **new Vercel project** from this repo with **Root Directory = `aggregate`**. The existing StrateX dashboard stays a separate project.
2. Postgres: Neon, Supabase or Vercel Postgres. Use the pooled connection string.
3. Environment variables are listed in `.env.example`:
   - Minimum: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL`, `CRON_SECRET`.
   - Live sending also needs `MAIL_TRANSPORT=smtp` plus `SMTP_MAILBOXES`.
   - Replies need `IMAP_*` (or point your provider's inbound webhook at `/api/inbound/email?secret=$INBOUND_SECRET`).
4. **Vercel Hobby plan** allows one cron run per day, so `vercel.json` runs the autopilot daily at 9am Central. For the full 15-minute cadence, either upgrade to Pro and set the tick schedule to `*/15 * * * *`, or point a free external scheduler (e.g. cron-job.org) at `GET https://<your-app>/api/cron/tick` every 15 minutes with header `Authorization: Bearer <CRON_SECRET>`. Hobby functions stop at 60 s; if the MSHA download times out, run `npm run msha:sync` locally against the production database.
5. `vercel.json` schedules the jobs:
   - `/api/cron/tick` every 15 minutes, which needs a Vercel Pro plan (Hobby allows daily crons only);
   - `/api/cron/msha-sync` every Monday.
   - Both routes use `maxDuration = 300`.
5. Run `DATABASE_URL=… npx prisma db push` once, then **Data → Sync MSHA now**.

## Before turning autopilot on
- [ ] **Separate sending domain** (e.g. `getstratex.com`), 2–3 mailboxes, SPF + DKIM + DMARC, **warmed 2–3 weeks**. Keep ≤ 40 emails/mailbox/day.
- [ ] Settings: physical mailing address (CAN-SPAM), from-email, booking link, notify-email.
- [ ] Load contacts (CSV or Apollo) and spot-check the top 20 leads and their "Preview first email".
- [ ] Leave Reply mode on **review** for the first few weeks; switch to autopilot once the drafts look right.
- [ ] Have the permitting lead confirm the items flagged `verify` in `src/lib/permits/catalog.ts` and `obligations.ts`: county ordinance dates, current WPDES permit expiration, fee tables.

## Regulatory basis (verified Sept 2026; confirm per site)
- **NR 135:**
  - life-of-mine reclamation permits from the county, or a municipality with its own ordinance;
  - application and plan contents: ss. 135.18–135.19;
  - transfer: s. 135.28;
  - operator annual report due **Jan 31** (s. 135.36); fee due Jan 31 unless the ordinance says otherwise (s. 135.39);
  - financial assurance: s. 135.40;
  - deposit registration under s. 295.20 lasts 10 years.
- **WPDES:** the Mineral (Nonmetallic) Mining and/or Processing General Permit **WI-0046515-07-2**, effective Dec 31, 2024.
- **Air:**
  - Crushing Plants General Construction & Operation Permit (Form 4530-141, 15-day decision);
  - NR 407.105 registration permits;
  - portable plants must file a relocation notice at least **20 days** before each move (Form 4500-025);
  - NSPS Subpart OOO applies to fixed plants over 25 tph and portable plants over 150 tph;
  - fugitive dust: NR 415.075.
- **High-capacity wells:** property capacity over 100,000 gpd, about 70 gpm (s. 281.34).
- **SPCC:** more than 1,320 gal aboveground, counting containers of 55 gal or more.
- **MSHA:** legal ID within 30 days of opening or any change; Form 7000-2 quarterly report; Part 46 training (24 h new miner, 8 h annual refresher).
- **$40k pricing:** fits a typical sand & gravel pit. Contested CUPs, groundwater modeling, wetland permitting and blasting/air modeling are excluded in the proposal terms and should be quoted on top.

## Code map
```
src/lib/permits/catalog.ts      permit rules engine (what a site needs, why, timeline)
src/lib/permits/obligations.ts  compliance calendar
src/lib/msha.ts, wdnr.ts        registry parsers + signal sources
src/lib/prospecting.ts          sync, scoring, CSV import, Apollo enrichment
src/lib/outreach/*              sequence, AI writer, mailer, send window, replies, IMAP
src/lib/proposals.ts            scope, e-sign, Stripe deposit, nudges
src/lib/delivery.ts, docs.ts    projects, intake, permit drafts, reminders
src/lib/autopilot.ts            the 15-minute tick
src/app/(admin)/*               dashboard, leads, pipeline, inbox, tasks, projects, data, settings
src/app/(public)/*              proposal, intake, unsubscribe pages
```
