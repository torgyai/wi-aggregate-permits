# Handoff: Wisconsin Aggregate Permitting Autopilot

**For:** Claude Cowork (or any operator) taking over setup and daily operation.
**Owner:** Christian (christian@torgy.ai), Stratex.
**Repo:** https://github.com/torgyai/wi-aggregate-permits (private, branch `main`)
**Hosting:** Vercel (Hobby plan), personal scope `torgyai`. Database: Postgres (Neon via Vercel Storage).
**Status (Sept 25 2026):** Code complete and tested; CI green. Deployment on Vercel was set up by hand by the owner and is being brought up. Nothing has ever emailed a real prospect.

---

## 1. What this business is

Stratex sells a **fixed-fee environmental permitting + compliance package** to Wisconsin aggregate producers: sand & gravel pits, limestone quarries, industrial (frac) sand mines.

| Tier | Typical job | Price |
|---|---|---|
| T1 Compliance tune-up / transfer | Existing site, new owner, bond reset, SWPPP/SPCC catch-up | $15k–25k |
| T2 Standard pit package | New or expanding sand & gravel pit | **$40k** |
| T3 Quarry package | Limestone quarry: blasting, crusher air permit, dewatering | $55k–75k |
| T4 Multi-site / industrial sand | 4+ sites or frac-sand operation | $90k–150k |
| Monthly compliance plan | Annual reports, fees, inspections, eDMRs, MSHA reports | $750–4,000/mo |

Payment: 50% deposit on signature, 50% at filing. Field studies, agency fees, bonds, contested hearings and PE stamps are excluded and passed through.

Best buyers: independent, family-owned operators with no environmental staff; new owners (every permit must transfer); anyone opening or expanding a pit. Large nationals (Vulcan, Michels, Mathy, Walbec…) have in-house teams and are deprioritized.

## 2. What the software does (end to end)

```
MSHA mine registry ─┐                                      ┌─ "send pricing" → proposal auto-sent
WDNR WPDES apps ────┼─► score 0–100 ─► enroll ─► 5-email ──┼─ "let's talk"   → booking link + task
40 target accounts ─┤    + price tier    (daily   sequence  ├─ not now / OOO / unsub / bounce → handled
CSV / Apollo ───────┘                     cap)   (Claude)   └─ question → AI draft → approve
proposal page → e-sign → Stripe deposit → intake questionnaire → permit list re-assessed
→ permit drafts (one per permit, CONFIRM markers) → client portal review/approve
→ you file with agencies → status tracking → compliance calendar + reminders → monthly plan
```

| Area | What's automatic | Where in the app |
|---|---|---|
| Lead sources | MSHA registry (every WI pit/quarry, weekly diff → new mine / owner change / reactivation signals); WDNR pending WPDES applications; 40 researched target accounts; CSV import (Apollo/Apify); Apollo enrichment | Data, Target accounts, Leads |
| Scoring & pricing | Explainable 0–100 score; pricing engine picks tier + price + monthly plan per site | Leads → site page |
| Outreach | 5 emails / 3 weeks + call & LinkedIn tasks; written per site by Claude (templates without key); send window 8–4 Central, weekdays; per-mailbox caps; threading; CAN-SPAM footer; one-click unsubscribe | Pipeline, Deal page |
| Replies | IMAP polling or inbound webhook; classified (interested, meeting, pricing, question, not now, not interested, unsubscribe, OOO, referral, bounce) and acted on | Inbox |
| Closing | Proposal built from the site's permit needs; public page; typed e-signature (name/title/email/IP/time); Stripe Checkout deposit (ACH/card) or "Mark paid"; auto follow-ups & expiry | Deal page, `/p/<token>` |
| Delivery | Intake questionnaire (+ reminders); permit list re-assessed on real data; one working draft per permit; client portal to read/approve/comment; filing status tracking; compliance calendar with 14-day client reminders; compliance-plan opt-in; balance payment | Projects, `/intake/<token>`, `/c/<token>` |
| Operator aids | Launch checklist (auto-detects what's done); 13-lesson training course; setup self-check | Launch checklist, Training, `/setup` |

**Safety lock:** email only leaves when **both** `LIVE_SEND=on` **and** `MAIL_TRANSPORT=smtp` (or `resend`). Otherwise every email is written and recorded in the app but nothing is sent ("Safe mode — no emails leave" badge in the top bar). **Do not set `LIVE_SEND=on` without the owner's explicit approval.**

## 3. Where things are

### Code map
```
prisma/schema.prisma            data model
scripts/vercel-build.mjs        Vercel build: creates tables if a DB is attached, then next build
scripts/msha-sync.ts            CLI: load MSHA registry (npm run msha:sync [-- --file Mines.zip])
src/lib/permits/catalog.ts      permit rules engine (what a site needs + why + timeline)
src/lib/permits/obligations.ts  compliance calendar (NR 135 Jan 31, WPDES Feb 15, etc.)
src/lib/pricing.ts, quote.ts    tier pricing engine
src/lib/msha.ts, wdnr.ts        registry parsers / signal sources
src/lib/prospecting.ts          sync, scoring, CSV import, Apollo enrichment
src/lib/outreach/*              sequence, AI writer, templates, mailer (safety lock), send window, reply handling, IMAP
src/lib/proposals.ts            scope, e-sign, Stripe deposit/balance, nudges
src/lib/delivery.ts, docs.ts    projects, intake, permit drafts, portal sharing, reminders
src/lib/autopilot.ts            the cron "tick"
src/lib/target-accounts.ts      the 40 researched accounts (data)
src/lib/training.ts, launch.ts  training course + launch checklist content
src/app/(admin)/*               operator UI (login required)
src/app/(public)/*              login, setup check, proposal, intake, client portal, unsubscribe
src/app/api/cron/*              tick (daily on Hobby) + weekly MSHA/WDNR sync
src/app/api/inbound/email       reply webhook (Postmark or generic JSON)
src/app/api/stripe/webhook      payment confirmations
```

### Docs in the repo
- `README.md`: architecture, setup, deploy, regulatory basis.
- `docs/manual-steps.md`: every human step (one-time, daily, per client).
- `docs/target-accounts.md`: 40 accounts with fit, trigger, scope, price, angle, sources.
- `docs/HANDOFF.md`: this file.

### Environment variables (Vercel → Settings → Environment Variables, Production)
| Variable | Required | Value / note |
|---|---|---|
| `DATABASE_URL` | yes | Set automatically by Vercel Storage → Neon. (Also accepts `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`.) |
| `AUTH_SECRET` | yes | Long random string. Value given to owner in chat. |
| `ADMIN_EMAIL` | yes | `christian@torgy.ai` |
| `ADMIN_PASSWORD` | yes | Given to owner in chat. |
| `CRON_SECRET` | yes | Given to owner in chat. |
| `APP_URL` | yes | The live `https://…vercel.app` URL (or custom domain). Used in all client links. |
| `MAIL_TRANSPORT` | yes | `log` while testing. `smtp` when going live. |
| `LIVE_SEND` | **leave unset** | `on` only at go-live with owner approval. |
| `SMTP_MAILBOXES` | at go-live | `user:app-password@smtp.gmail.com:587,user2:…` |
| `IMAP_HOST/PORT/USER/PASS` | at go-live | Reply inbox (e.g. imap.gmail.com, 993). |
| `ANTHROPIC_API_KEY` | optional | Claude writes emails/replies/drafts; without it, templates are used. |
| `APOLLO_API_KEY` | optional | Finds owners' emails (credits; daily cap in Settings). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | ACH/card deposits. Webhook URL: `<APP_URL>/api/stripe/webhook`. |
| `INBOUND_SECRET` | optional | Protects `/api/inbound/email`. |

**After changing any variable: Deployments → ⋯ → Redeploy.** Changes don't apply otherwise.

## 4. Current state & known issues

- ✅ Code: 35 unit tests, lint, typecheck, production build all pass; CI green on GitHub Actions.
- ✅ End-to-end tested in a browser in safe mode (lead → outreach → reply → proposal → signature → intake → drafts → portal approval → compliance plan).
- ⏳ **Vercel deployment:** owner created the project manually. Latest fixes (commit `90dc510`) make the build tolerant of a missing/renamed DB variable and add `/setup`. **First thing to do: open `<APP_URL>/setup` and resolve what it lists.**
- ⚠️ **Hobby plan limits:** cron runs once a day (9am Central) instead of every 15 min; functions stop at 60 s. For the full cadence: upgrade to Pro and set the tick cron to `*/15 * * * *` in `vercel.json`, or have an external scheduler (cron-job.org) call `GET <APP_URL>/api/cron/tick` with header `Authorization: Bearer <CRON_SECRET>` every 15 min. If "Sync MSHA now" times out, run `npm run msha:sync` from a computer with `DATABASE_URL` set to the production DB.
- ⚠️ The Claude Code Vercel connector couldn't access the `torgyai` Vercel scope (403). Reconnect with access to that scope if you want an agent to manage Vercel directly.
- ℹ️ An older copy exists as branch `claude/tender-goodall-mm0efg` in `ChristianStratex/stratex` (unpushed; no write access). **`torgyai/wi-aggregate-permits` is the source of truth.**
- ℹ️ Regulatory facts were verified Sept 2026 from public sources; items marked `verify` in `src/lib/permits/*.ts` (county ordinance dates, current WPDES permit expiration, fee tables) need a permitting professional's confirmation before relying on them.
- ℹ️ Target accounts to double-check before outreach: #12 Hi-Crush Whitehall (buyer unknown), #11 Superior Silica (status), #20 Earth Inc. (2019 trigger), #24 Kiel S&G (ownership change unconfirmed), #28 C&C Thompson (single source), #8 Wissota (HQ).

## 5. Runbook for Cowork: do these in order

> Guardrails: never set `LIVE_SEND=on`, never send email from Gmail on the owner's behalf, never buy anything (domains, plans, credits) and never sign up for services without the owner's explicit yes. Stop and ask when a step needs a payment, a password you don't have, or a legal/insurance decision.

### Phase A: Get the app running (≈20 min)
1. Vercel dashboard → project **wi-aggregate-permits** → confirm latest deployment of commit `90dc510` (or newer) is **Ready**. If it failed, open the build log and report the red error.
2. Storage tab: confirm a **Neon Postgres** database is connected to the project (create one if not: Storage → Create → Neon, free, connect to Production). Redeploy.
3. Settings → Environment Variables: confirm the required variables in §3 exist; `ADMIN_EMAIL` = `christian@torgy.ai`; `MAIL_TRANSPORT` = `log`; `LIVE_SEND` absent. Set `APP_URL` to the live URL. Redeploy.
4. Open `<APP_URL>/setup` → must say "Everything is configured". Fix anything it lists.
5. Sign in at `<APP_URL>/login`.

### Phase B: Load data (≈15 min)
6. **Target accounts** page → **Load into app** (adds 40 companies; no contacts; nothing emailed).
7. **Data** page → **Sync MSHA now** (all WI pits/quarries). If it times out on Hobby, note it for the owner (CLI fallback in §4). Then **Sync WDNR now**.
8. **Settings** → fill Sender identity: company "Stratex", sender name, title, phone, booking link (Calendly/Cal.com 15-min), notify email, **physical mailing address** (required by law), website. Keep Reply mode = review, Autopilot off for now. Save.

### Phase C: Test in safe mode (≈30 min)
9. **Launch checklist** → review; everything auto-detectable should turn green as you go.
10. Add a test contact (your own address) to one target account site → **Start outreach now** → Dashboard → **Run autopilot now** → open the deal: timeline should show "recorded (safe mode)".
11. From the deal: **Create & send proposal** → open the proposal link in a private window → sign → fill the intake → back in Projects: **Generate pending drafts** → **Share drafts with client** → open the portal link → approve a draft. Confirm everything appears; nothing leaves (safe mode).
12. Read Training (13 lessons) or summarize it for the owner.

### Phase D: Prepare go-live (needs owner decisions / purchases)
13. Owner approves & buys: separate outreach domain (e.g. getstratex.com), 2–3 Google Workspace mailboxes, E&O insurance, PE/PG partner, (optional) Vercel Pro, Anthropic/Apollo/Stripe keys.
14. DNS: SPF, DKIM, DMARC for the outreach domain; check mail-tester.com ≥ 9/10.
15. Warm up mailboxes 2–3 weeks (warm-up tool).
16. Contacts: for priority accounts (Janak & Sons, Kopplin & Kinas, Griesbach Concrete, Todd's Redi-Mix, DB Quarry, Blue Rock Quarry, R.G. Huston, Zobel, Bindl Bauer) find the owner/president email (Apollo, company website, LinkedIn) and add on the site page or via CSV (Data page). Columns: first_name, last_name, email, title, company_name, company_domain.
17. Set `SMTP_MAILBOXES`, `IMAP_*` env vars; redeploy.

### Phase E: Go live (owner's explicit OK only)
18. Settings: New leads/day 10, Emails/mailbox/day 20, Autopilot on.
19. Vercel env: `MAIL_TRANSPORT=smtp`, `LIVE_SEND=on` → redeploy. Top bar should switch to "Live sending".
20. Daily: Inbox approvals, Tasks (calls/meetings), watch autopilot log. Weekly: syncs ran, move permit statuses.

## 6. Daily operating routine (after go-live)
1. Dashboard: autopilot log all green.
2. Inbox: approve/edit drafted replies.
3. Tasks: calls, LinkedIn, meetings, filings.
4. Take booked 15-min calls (script: Training → "The 15-minute call"); after each call: stage → Meeting, adjust price if needed, **Create & send proposal**.
5. Projects: move permit statuses; resolve CONFIRM items with clients; file approved permits with agencies (table in Training → "From signature to permits in hand").

## 7. Troubleshooting
| Symptom | Fix |
|---|---|
| Any page redirects to `/setup` | A required variable is missing; add it, redeploy. |
| "Something went wrong" page | Usually DB not connected or tables missing → `/setup`; redeploy after connecting Neon. |
| Login says wrong email/password | Must match `ADMIN_EMAIL`/`ADMIN_PASSWORD` exactly; redeploy after changes. |
| Build fails | Read the red lines in the Vercel build log; the build no longer fails for a missing DB, so it's a code/config error to report. |
| Links in emails/portal point to localhost | Set `APP_URL`, redeploy. |
| Sync MSHA times out | Hobby 60 s limit → run `npm run msha:sync` locally against prod DB, or upgrade to Pro. |
| Emails not sending | Expected in safe mode. Live needs `LIVE_SEND=on` + `MAIL_TRANSPORT=smtp` + mailboxes + redeploy. |
| Replies not showing | Set `IMAP_*` or configure the inbound webhook to `<APP_URL>/api/inbound/email?secret=<INBOUND_SECRET>`. |
