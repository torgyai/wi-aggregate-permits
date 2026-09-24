/**
 * In-app training course. Markdown lessons rendered by components/Markdown.
 * Progress is stored in Setting "training:done" (array of lesson slugs).
 */
export type Lesson = { slug: string; title: string; minutes: number; summary: string; body: string; takeaways: string[] };
export type Module = { title: string; lessons: Lesson[] };

export const COURSE: Module[] = [
  {
    title: "1 · The business",
    lessons: [
      {
        slug: "business",
        title: "What we sell, to whom, and why they pay",
        minutes: 6,
        summary: "The offer, the buyer, the price tiers and the math that makes this a real business.",
        body: `## The offer
We take **all** of the permitting for a Wisconsin pit or quarry off the operator's plate for a **fixed fee**. We draft every application and plan, deal with the county and WDNR, answer comments and chase decisions. The client reviews and signs.

## Who buys
- **Independent, family-owned sand & gravel and stone operators.** One to fifteen sites, no environmental staff. The owner or GM does permits at night, badly, or pays an engineering firm by the hour.
- **Excavating and road contractors that own their own pits.** Permits are a distraction from their real business.
- **New owners.** When a pit changes hands, every permit has to transfer — and most buyers find out late.
- **Operators expanding or opening a new pit.** The full stack (county reclamation permit, conditional use, WPDES, air, MSHA) is due before the first load leaves.

Large nationals (Vulcan, CRH/Mathy, Heidelberg, Holcim…) have in-house teams; the app scores them down on purpose.

## Why they pay a flat fee
- Hourly consultants make the bill unpredictable. A number they can budget is worth more than a lower estimate.
- A lost season costs far more than the fee. A 20-truck/day pit idle for one summer loses more than $40k in margin.
- Permits run **in parallel** under one owner, so the slowest one sets the start date — not the sum of all of them.

## The price tiers (the app suggests one per site)
| Tier | Typical job | Price |
|---|---|---|
| T1 Compliance tune-up / transfer | Existing site, new owner, bond reset, SWPPP/SPCC catch-up | $15k–25k |
| T2 Standard pit package | New or expanding sand & gravel pit | **$40k** |
| T3 Quarry package | Limestone quarry: blasting, crusher air permit, dewatering | $55k–75k |
| T4 Multi-site / industrial sand | 4+ sites or a frac sand operation | $90k–150k |
| Compliance plan (monthly) | Annual reports, fees, inspections, eDMRs, MSHA reports | $750–4,000/mo |

## The math
- One T2 deal a month = **$480k/year**. Two = ~$1M.
- Every signed client can roll into the compliance plan. Twenty clients at $1,500/mo = **$360k/year recurring**, with little work because the calendar is automated.
- Cost of goods: your time plus occasional subcontractors (surveyor, wetland delineator, hydrogeologist, PE stamp), which the proposal excludes and passes through.`,
        takeaways: [
          "Sell certainty: one fixed fee, one owner, permits in parallel.",
          "Target independents and new owners; skip nationals.",
          "The monthly compliance plan is where the recurring money is.",
        ],
      },
    ],
  },
  {
    title: "2 · Wisconsin permitting in plain English",
    lessons: [
      {
        slug: "permits-101",
        title: "Every permit a pit or quarry can need",
        minutes: 12,
        summary: "What each permit is, who issues it, when it applies and what the client actually gets.",
        body: `The app's permit engine (Leads → any site → *Permit needs*) applies these rules automatically. You need to understand them well enough to talk about them on a call.

### NR 135 reclamation permit — the big one
- **Who:** the county (or a town/city/village with its own ordinance). Required for any nonmetallic mine affecting **1 acre or more**.
- **What:** a *life-of-mine* permit backed by a **reclamation plan** (site maps, geology, topsoil, groundwater, end land use, phasing, slopes, seeding) and **financial assurance** (a bond sized to what it would cost the county to reclaim the site).
- **Timing:** the authority decides 30–90 days after a complete application (longer with a hearing).
- **Transfers:** a new operator must post its own financial assurance and get a written finding (NR 135.28). This is why ownership changes are our best trigger.
- **Every year:** operator report and fee due **January 31**.

### Conditional use permit (CUP) / local zoning
- County or town zoning. New pits and expansions almost always need one: application, operations plan (hours, trucks, haul route, berms, dust), **public hearing**.
- Neighbors show up. Our job is to answer their objections in writing before the meeting.
- Note: under s. 66.0441 an *active* quarry can't be forced into a new CUP/license unless the ordinance predates the quarry.

### WPDES Nonmetallic Mining General Permit (WI-0046515-07-2)
- WDNR water permit for storm water and process water (pit dewatering, wash water). Nearly every operating pit needs coverage.
- Filed as an electronic Notice of Intent. Comes with a **SWPPP**, quarterly inspections, sampling and eDMRs, and an annual report.

### Air permit (crushers and screens)
- WDNR Air. Most plants fit the **Crushing Plants General Construction & Operation Permit** (Form 4530-141, 15-day decision). Bigger ones need a registration or site-specific permit.
- Federal **NSPS Subpart OOO** applies to fixed plants over 25 tph and portable plants over 150 tph (opacity tests, inspections).
- **Portable plants must notify WDNR at least 20 days before every move** (Form 4500-025).

### High-capacity well approval
- Wells on one property with combined capacity **over 100,000 gallons/day (~70 gpm)** need WDNR approval before construction. Dewatering and wash plants trigger this.

### Wetlands / waterways
- Any fill or excavation in wetlands or near navigable water: state permits (ch. 30, s. 281.36, NR 340 for ponds near waterways) and often an Army Corps 404. Starts with a delineation (a subcontractor — excluded from the fee).

### Endangered resources review
- WDNR screening for protected species. Encouraged, not required — but it avoids late surprises. About $75/hr.

### SPCC plan (EPA)
- More than **1,320 gallons** of oil above ground (containers of 55 gal or more) → a written spill plan, containment, inspections. Almost every pit with a fuel tank qualifies.

### MSHA
- New mine or new operator: notify the district and file a **Legal Identity Report** within 30 days. Part 46 training plan (24 h new miner, 8 h annual refresher). Quarterly Form 7000-2 employment reports.

### Blasting (quarries)
- Licensed blaster, vibration and airblast limits, seismograph records on every blast (SPS 307), often pre-blast surveys.

### Marketable deposit registration (optional upsell)
- Registers proven reserves so future zoning can't block them (s. 295.20). Lasts 10 years.`,
        takeaways: [
          "NR 135 + financial assurance is the core of every job.",
          "Ownership change = every permit must transfer.",
          "Crushers mean air permits; portable crushers mean 20-day move notices.",
          "Dewatering/washing can trigger WPDES process-water terms and high-cap wells.",
        ],
      },
    ],
  },
  {
    title: "3 · How the autopilot works",
    lessons: [
      {
        slug: "autopilot",
        title: "What runs, when, and what it does on its own",
        minutes: 7,
        summary: "The 15-minute tick, the weekly registry sync, and every decision the software makes without you.",
        body: `## Every Monday
- **MSHA sync** downloads the federal mine registry and loads every Wisconsin aggregate site. It compares to last week and creates **signals**: new mine, ownership change, reactivation.
- **WDNR sync** pulls pending WPDES nonmetallic mining applications — someone filing is permitting right now.
- Every site is **re-scored 0–100** with reasons.

## Every 15 minutes (weekdays 8–4 Central for sending)
1. **Replies** — reads the inbox, classifies every reply and acts (table in lesson 5).
2. **Drafts** — writes permit drafts for signed clients, a couple per run.
3. **Enroll** — starts today's best new leads (score ≥ your minimum, one decision maker per company, never anyone suppressed, excluded or already worked).
4. **Send** — sends due sequence emails within mailbox caps; creates call/LinkedIn tasks.
5. **Proposals** — nudges unopened/unsigned proposals, expires old ones.
6. **Intake & deposits** — reminds clients who haven't filled the questionnaire or paid the deposit.
7. **Compliance** — reminds clients 14 days before every due date.
8. **Enrich** (daily) — Apollo lookups for top leads without a contact.

## Safe mode
Until **LIVE_SEND=on** is set on the server, *nothing is emailed*. Every email is still written, recorded and visible in the app, so you can run the whole machine end to end and read exactly what would have gone out. The top bar always shows which mode you are in.

## The switches (Settings)
- **Autopilot on/off** — master switch.
- **Reply mode** — *review* (every drafted reply waits for you) or *autopilot* (confident replies send themselves).
- **Min score, new leads/day, emails/mailbox/day** — your volume dials.`,
        takeaways: [
          "The app does prospecting, sending, reply handling, proposals, reminders and drafts.",
          "Safe mode records everything and sends nothing — test there first.",
          "You control volume with three dials in Settings.",
        ],
      },
    ],
  },
  {
    title: "4 · Leads",
    lessons: [
      {
        slug: "leads",
        title: "Finding, scoring and qualifying leads",
        minutes: 6,
        summary: "Where leads come from, what the score means, and when to override it.",
        body: `## Sources
1. **MSHA registry** — every pit and quarry with operator, county, status, coordinates.
2. **WDNR applications** — active permitting.
3. **Target accounts** — the hand-researched list of 40 Wisconsin operators with suggested pricing (Target accounts page).
4. **Contacts** — CSV from Apollo/Apify/anything (Data page), Apollo enrichment, or add by hand on a site page.
5. **You** — add a site by hand from a county hearing notice, a newspaper item or a referral, and add a *Zoning hearing* signal.

## Reading the score
Each point has a reason on the site page. Biggest movers: fresh ownership change (+25), expansion/hearing (+25), new mine (+25), WDNR application (+20), industrial sand (+20), independent operator (+10), email on file (+10). Large nationals get −30.

## Qualify before the call (2 minutes)
- Site page → **Permit needs**: what is REQUIRED vs CHECK.
- **Suggested price** card: tier and reasons.
- Google the company: website, recent news, county agenda mentions.

## When to override
- Wrong fit (competitor, government pit, clearly national): **Exclude company** on the deal/site page.
- Known expansion or hearing: add a signal — the score and the permit list update immediately.
- Fix facts (crusher? washing? acres?) under *Site facts*.`,
        takeaways: ["Signals drive urgency; the score explains itself.", "Fix facts and add signals by hand — the engine re-prices and re-scopes.", "Exclude bad fits so autopilot never touches them."],
      },
    ],
  },
  {
    title: "5 · Outreach & replies",
    lessons: [
      {
        slug: "outreach",
        title: "The sequence and deliverability",
        minutes: 7,
        summary: "What gets sent, how it stays out of spam, and the rules you never break.",
        body: `## The sequence (≈3 weeks)
| Day | Touch | Job |
|---|---|---|
| 0 | Email | Site-specific opener: trigger + 2–3 permits that likely apply + ask for 15 minutes |
| 3 | Email (same thread) | One useful insight about their biggest permit |
| 6 | Call task | Reference the emails; ask who owns the reclamation/WPDES paperwork |
| 9 | Email (new thread) | Cost of delay; permits in parallel |
| 13 | LinkedIn task | Connect with a one-line note |
| 16 | Email (thread) | Exactly what the package includes; ask for the right person |
| 21 | Email (thread) | Polite close-the-loop, offer a one-page checklist |

Emails are written per site by Claude (or templates without a key). Preview any lead's first email on its site page.

## Deliverability rules
- **Never send from your main domain.** Buy a lookalike (e.g. getstratex.com), 2–3 mailboxes, SPF + DKIM + DMARC.
- **Warm up 2–3 weeks** before any real sends. Then ≤ 40 emails/mailbox/day.
- Plain text, no tracking pixels, no attachments, no links in the first email (the app already does this).
- Every email has your physical address and an unsubscribe link (CAN-SPAM). Unsubscribes are permanent and automatic.
- Watch bounce rate: over 3% means your contact data is bad — stop and clean it.`,
        takeaways: ["Separate domain, warm-up, low volume.", "Unsubscribes and bounces are handled automatically and permanently.", "Preview emails before turning on live sending."],
      },
      {
        slug: "inbox",
        title: "The inbox: what the app does with every reply",
        minutes: 5,
        summary: "Reply classes, automatic actions, and how to approve drafts in one click.",
        body: `| Reply | Automatic action | You |
|---|---|---|
| Wants pricing / proposal | Proposal built from the site's permit needs and sent in-thread | Watch for the signature notification |
| Interested / wants a call | Drafted reply with your booking link; meeting task | Approve (review mode) and take the call |
| Question | Claude drafts an answer from the permit profile | Read, edit, send |
| Not now | Acknowledgement + re-engage task on the date they implied | Nothing |
| Referral | New contact added, thank-you drafted | Approve |
| Not interested | Sequence stops, deal lost | Nothing |
| Unsubscribe | Suppressed forever | Nothing |
| Out of office | Sequence paused until they're back | Nothing |
| Bounce | Contact marked bad, suppressed | Nothing |

**Approving:** Inbox shows their message on the left and the draft on the right. Edit if needed, click **Send**. In safe mode "send" records the reply but nothing leaves.

**Reply mode → autopilot** lets confident "interested / not now / referral" replies send themselves. Keep *review* for your first few weeks.`,
        takeaways: ["Most replies need nothing from you.", "Approve drafts from the Inbox in one click.", "Switch to autopilot replies once you trust the drafts."],
      },
    ],
  },
  {
    title: "6 · Selling",
    lessons: [
      {
        slug: "sales-call",
        title: "The 15-minute call: script and objections",
        minutes: 10,
        summary: "Discovery questions, the pitch, the price talk and answers to the objections you will hear.",
        body: `## Before the call (2 min)
Open the deal: site, signals, permit needs, suggested price.

## Script
1. **Open (30s):** "Thanks for making time. I looked at **{site}** in {county} County — {trigger}. Can I ask a few questions so I'm not guessing?"
2. **Discovery (6 min):**
   - "What's the plan for the site over the next 12–24 months — expand, new pit, keep as is?"
   - "Who handles your reclamation permit and annual report today? When did the county last look at your bond?"
   - "Crusher on site? Portable? Wash plant? Pumping water out?"
   - "Any wetlands, streams or close neighbors?"
   - "Has the county or town asked for anything lately?"
   - "When do you need to be hauling from it?"
3. **Reflect (1 min):** "So the long pole is {slowest permit}; you also need {2–3 others}. Filed one at a time that's {X} months; in parallel it's {Y}."
4. **Offer (2 min):** "We do all of it for one fixed fee: every application and plan, the county and WDNR back-and-forth, hearing prep, and a 12-month compliance calendar. You review and sign. For a site like yours that's **{price}** — {deposit}% to start, the rest when we file."
5. **Close (1 min):** "I'll send the proposal today; it lists every permit and deliverable. If it looks right you can sign online and we start with a 15-minute questionnaire."

After the call: Deal page → **Move stage → Meeting**, add a note, click **Create & send proposal** (adjust the price first if needed).

## Objections
- **"We do it ourselves."** — "Most owners do. The question is what your hours are worth and what a rejected application costs you in a season. We turn it into a fixed number."
- **"Our engineer does it."** — "Good — keep them for design. We handle the permit paperwork and agency follow-up at a fixed fee, and can work with their drawings."
- **"Too expensive."** — "Compared to what? One lost season on a 20-truck pit is more than the fee. And we can scope down: a transfer/tune-up is $15–25k."
- **"Not now."** — "When would it be? Permits take 3–6 months, so we'd start about {date} to be hauling by {season}." (The app schedules the follow-up.)
- **"Send me something."** — Send the proposal. It is the brochure.
- **"Can you guarantee approval?"** — "No one can honestly guarantee an agency decision. We guarantee a complete, correct application and that we'll see it through to a decision."`,
        takeaways: ["Ask about plans, water, crusher, neighbors, deadline.", "Anchor on the cost of a lost season.", "Always leave with a proposal sent."],
      },
      {
        slug: "pricing",
        title: "Pricing, proposals and getting paid",
        minutes: 6,
        summary: "How the pricing engine works, when to override it, and the payment flow.",
        body: `## The pricing engine
The price is set per site from the permits it needs:
- Existing site, transfer or catch-up → **T1** $15–25k
- New/expanding sand & gravel → **T2** $40k (+$5k each for high-cap well or wetlands)
- Quarry / blasting / crusher + high-cap → **T3** $55–75k
- 4+ sites or industrial sand → **T4** $90–150k
- Compliance plan: $750/mo base + $350/site, $2,000+ for industrial sand

**Override** on the deal page (Price) when you know better — the override sticks.

## Proposal
Built automatically: every permit in scope with agency, citation, reason and deliverables; timeline; exclusions (field studies, agency fees, contested hearings, PE stamps); payment terms; optional compliance plan. Unguessable link, valid 30 days, up to three automatic follow-ups.

## Getting paid
- Client signs online (name/title/email, IP and timestamp stored).
- **Stripe configured:** they go straight to Checkout for the deposit (ACH or card). Balance link appears on their portal at filing.
- **No Stripe:** send an invoice and click **Mark deposit paid** / **Mark balance paid** on the project.`,
        takeaways: ["Let the engine price; override when you know more.", "Exclusions protect your margin — keep them.", "Deposit before work, balance at filing."],
      },
    ],
  },
  {
    title: "7 · Delivering the work",
    lessons: [
      {
        slug: "delivery",
        title: "From signature to permits in hand",
        minutes: 9,
        summary: "Intake, drafts, CONFIRM items, client review, filing with each agency and tracking to approval.",
        body: `## 1. Intake (automatic)
On signature the client gets a questionnaire (reminders on days 2, 5, 9; then a call task). Answers re-run the permit engine with real numbers.

## 2. Drafts (automatic)
One working draft per permit. Anything unknown is highlighted **CONFIRM** — never guessed. Project page shows how many CONFIRM items each draft has.

## 3. Your review (you)
- Read each draft; fix facts; **Regenerate** after the intake is corrected.
- Resolve CONFIRM items with the client (a 20-minute call is fastest).
- Where a professional stamp is required (engineering drawings, some reclamation plans, hydrogeology), use your PE/PG partner.

## 4. Client review (portal)
Click **Share drafts with client**. They get a portal link where they read each draft and click **Approve** or leave a comment. Approved permits move to *Ready to file* and a filing task appears for you.

## 5. Filing (you)
| Permit | Where it's filed |
|---|---|
| NR 135 reclamation permit | County zoning / land conservation department (or the municipality with its own ordinance) |
| Conditional use | County or town zoning office; attend the hearing |
| WPDES general permit | WDNR Water Permit Applications (ePermitting) — Storm Water Industrial NOI |
| Air (crushing plants) | WDNR Air program — Form 4530-141 general permit application |
| High-capacity well | WDNR Drinking & Groundwater (Form 3300-258 for dewatering) |
| ER review | WDNR Natural Heritage Conservation request |
| MSHA | MSHA district notification + Legal Identity Report (Form 2000-7) |
| SPCC | Not filed — kept on site, certified |

Set each permit to **Submitted** when filed, **Agency review** when comments come in, **Approved** when issued. The project status follows automatically; at "all approved" it moves to *Compliance*.

## 6. Compliance calendar (automatic)
Built from the permits in scope. Clients are reminded 14 days before each due date and offered the compliance plan.`,
        takeaways: ["Intake and drafts are automatic; review and filing are yours.", "Never file with open CONFIRM items.", "Share → approve → file → track to approval."],
      },
      {
        slug: "retention",
        title: "The compliance plan: recurring revenue",
        minutes: 4,
        summary: "How clients opt in and what you do each month.",
        body: `After approval every client has a calendar: NR 135 report and fee (Jan 31), WPDES quarterly inspections/eDMRs and annual report (Feb 15), air certifications and records, MSHA quarterly 7000-2 and annual refresher, SPCC five-year review, financial assurance review.

- Clients see the calendar on their portal and can click **Start compliance plan**.
- Reminder emails 14 days out mention the plan.
- When they opt in you get a task to set up billing (Stripe subscription or monthly invoice).
- Each month: open the project's calendar, do what's due, click **Done** — the next occurrence is scheduled automatically.`,
        takeaways: ["Every client is a recurring-revenue candidate.", "Opt-in is one click on the portal.", "Done → next occurrence scheduled."],
      },
    ],
  },
  {
    title: "8 · Operating rhythm",
    lessons: [
      {
        slug: "routine",
        title: "Your daily 20 minutes and weekly hour",
        minutes: 4,
        summary: "Exactly what to check and in what order.",
        body: `## Daily (20 minutes, morning)
1. **Dashboard** — autopilot log all green? Any red rows → read the error.
2. **Inbox** — approve or edit drafted replies.
3. **Tasks → Due now** — calls, meetings, LinkedIn, filings.
4. **Pipeline** — anyone in *Replied* or *Meeting* without a next step?

## Weekly (1 hour, Monday)
- **Data** — confirm the MSHA/WDNR sync ran; skim new signals.
- **Leads** — spot-check the top 20 and preview a few emails.
- **Projects** — move permit statuses; chase agency comments.
- Metrics: sends, reply rate (healthy: 2–5% positive), meetings booked, proposals out, signed.

## Monthly
- Compliance calendar items for plan clients.
- Tune: min score, daily volume, sequence copy (src/lib/outreach/templates.ts and sequence.ts).`,
        takeaways: ["Inbox and tasks every morning.", "Syncs and projects weekly.", "Measure positive reply rate and meetings, not sends."],
      },
      {
        slug: "legal",
        title: "Legal and risk guardrails",
        minutes: 4,
        summary: "What keeps you out of trouble.",
        body: `- **CAN-SPAM:** truthful headers and subject lines, physical address, working unsubscribe honored within 10 business days (the app does it instantly). B2B cold email is legal in the US under these rules.
- **No guarantees:** never promise approval or agency timelines. The proposal terms say so.
- **Professional stamps:** where an agency requires a PE or professional geologist, use a licensed partner. You prepare and manage; they certify.
- **Not legal advice:** permitting guidance, not legal opinions. Refer zoning litigation to an attorney.
- **Insurance:** carry professional liability (E&O) before signing clients.
- **Pass-through costs:** agency fees, bonds, surveys and field studies are excluded — keep them out of your fixed fee.
- **Data:** the regulatory rules in the app were verified in Sept 2026; items marked *verify* need a check against the county ordinance or current permit.`,
        takeaways: ["Address + unsubscribe on every email.", "No approval guarantees; stamps from licensed partners.", "E&O insurance before the first client."],
      },
    ],
  },
];

export const ALL_LESSONS = COURSE.flatMap((m) => m.lessons);
export const TRAINING_KEY = "training:done";
