/**
 * The outbound sequence. Five emails over ~3 weeks, with a call and a LinkedIn
 * touch as human tasks in between (optional — turn off "manual steps as tasks"
 * for email-only). Every email is written fresh per site by the AI writer; the
 * `intent` tells it what job that touch does.
 */
export type StepChannel = "EMAIL" | "CALL" | "LINKEDIN";

export type SequenceStep = {
  day: number;
  channel: StepChannel;
  intent: "opener" | "specific_permit" | "call" | "timeline_risk" | "linkedin" | "proof" | "breakup";
  /** Reply in the same thread as the previous email. */
  threaded?: boolean;
  guidance: string;
};

export const DEFAULT_SEQUENCE_KEY = "wi-permit-v1";

export const SEQUENCES: Record<string, { name: string; steps: SequenceStep[] }> = {
  [DEFAULT_SEQUENCE_KEY]: {
    name: "Wisconsin pit & quarry permitting",
    steps: [
      {
        day: 0,
        channel: "EMAIL",
        intent: "opener",
        guidance:
          "Open with the specific site and the trigger (new mine, ownership change, reactivation, expansion — or simply the permits a site like theirs carries). Name 2–3 approvals that likely apply. One clear ask: a 15-minute call to walk through what their county and WDNR will want.",
      },
      {
        day: 3,
        channel: "EMAIL",
        intent: "specific_permit",
        threaded: true,
        guidance:
          "Short bump in the same thread. Give one concrete, useful insight about the single most important permit for this site (what the agency looks for, a common reason applications get sent back). No pitch beyond offering to help.",
      },
      {
        day: 6,
        channel: "CALL",
        intent: "call",
        guidance: "Call the office. Reference the emails, ask who handles their reclamation permit and WPDES paperwork.",
      },
      {
        day: 9,
        channel: "EMAIL",
        intent: "timeline_risk",
        guidance:
          "New thread, new angle: the cost of delay. Permits run in parallel but the slowest one (often the conditional use hearing or air permit) sets the start date; a season lost is real money. Offer a fixed-fee package that runs them all in parallel. Ask if the timing is right this season.",
      },
      {
        day: 13,
        channel: "LINKEDIN",
        intent: "linkedin",
        guidance: "Connect on LinkedIn with a one-line note referencing the site.",
      },
      {
        day: 16,
        channel: "EMAIL",
        intent: "proof",
        threaded: true,
        guidance:
          "Explain exactly what the flat-fee package includes (drafted applications, reclamation plan, financial assurance estimate, SWPPP, hearing prep, 12-month compliance calendar) and that they review and sign rather than write. Ask for the right person if it isn't them.",
      },
      {
        day: 21,
        channel: "EMAIL",
        intent: "breakup",
        threaded: true,
        guidance:
          "Polite close-the-loop. Two or three sentences. Offer to send a one-page permit checklist for their site if useful, and say you won't follow up again.",
      },
    ],
  },
};

export function getSequence(key: string) {
  return SEQUENCES[key] ?? SEQUENCES[DEFAULT_SEQUENCE_KEY];
}
