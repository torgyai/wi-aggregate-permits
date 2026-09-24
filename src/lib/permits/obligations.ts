/**
 * Recurring compliance obligations for a permitted Wisconsin pit/quarry.
 * Generated when a project's permits are known; drives client reminders and
 * the annual compliance retainer.
 *
 * Due dates marked `verify` are defaults — the regulatory authority's ordinance
 * or the permit itself controls. The permitting lead confirms them per site.
 */

export type ObligationDef = {
  key: string;
  permitKey: string;
  title: string;
  detail: string;
  citation: string;
  cadence: "ANNUAL" | "QUARTERLY" | "MONTHLY" | "ONE_TIME";
  /** For ANNUAL: month (1-12) and day the item is due. */
  month?: number;
  day?: number;
  verify?: string;
};

export const OBLIGATIONS: ObligationDef[] = [
  {
    key: "NR135_ANNUAL_REPORT",
    permitKey: "NR135_RECLAMATION",
    title: "NR 135 annual operator report",
    detail:
      "Report the prior calendar year's acres disturbed, reclaimed and interim-reclaimed to the regulatory authority. Required for active and intermittent sites until reclamation is certified complete.",
    citation: "Wis. Admin. Code s. NR 135.36",
    cadence: "ANNUAL",
    month: 1,
    day: 31,
  },
  {
    key: "NR135_ANNUAL_FEE",
    permitKey: "NR135_RECLAMATION",
    title: "NR 135 annual reclamation permit fee",
    detail: "Pay the regulatory authority's annual fee (includes the WDNR share) on unreclaimed acres for the prior year.",
    citation: "Wis. Admin. Code s. NR 135.39",
    cadence: "ANNUAL",
    month: 1,
    day: 31,
    verify: "Due Jan 31 unless the county ordinance sets another date; amount follows the ordinance fee schedule.",
  },
  {
    key: "FA_REVIEW",
    permitKey: "FINANCIAL_ASSURANCE",
    title: "Financial assurance review",
    detail: "Compare bonded amount to current disturbed acreage; request phase releases for reclaimed areas.",
    citation: "Wis. Admin. Code s. NR 135.40",
    cadence: "ANNUAL",
    month: 4,
    day: 30,
  },
  {
    key: "SWPPP_INSPECTION",
    permitKey: "WPDES_NMM_GP",
    title: "Quarterly storm water inspection, sampling & eDMR",
    detail:
      "Quarterly visual inspection of BMPs and outfalls, total suspended solids sampling where the permit requires it, and eDMR submittal (21 days after the reporting period). Keep the SWPPP current.",
    citation: "WPDES General Permit WI-0046515-07-2; Wis. Admin. Code ch. NR 216",
    cadence: "QUARTERLY",
    verify: "Match sampling points and eDMR schedule to the site's coverage letter.",
  },
  {
    key: "WPDES_ANNUAL",
    permitKey: "WPDES_NMM_GP",
    title: "WPDES annual site inspection & monitoring report",
    detail: "Annual facility site compliance inspection and the annual monitoring report to WDNR.",
    citation: "WPDES General Permit WI-0046515-07-2",
    cadence: "ANNUAL",
    month: 2,
    day: 15,
    verify: "Confirm the annual report date on the current permit (reported as Feb 15).",
  },
  {
    key: "AIR_ANNUAL_CERT",
    permitKey: "AIR_PERMIT",
    title: "Air permit annual monitoring summary & compliance certification",
    detail: "General/registration permit holders certify compliance and summarise monitoring for the prior year.",
    citation: "Wis. Admin. Code ch. NR 407; Crushing Plants General Permit",
    cadence: "ANNUAL",
    month: 3,
    day: 1,
    verify: "Due date follows the permit's reporting condition.",
  },
  {
    key: "AIR_EMISSIONS_INVENTORY",
    permitKey: "AIR_PERMIT",
    title: "Air emissions inventory / throughput records",
    detail: "Compile monthly throughput and hours; submit the annual emissions inventory if the permit requires it.",
    citation: "Wis. Admin. Code ch. NR 438",
    cadence: "ANNUAL",
    month: 3,
    day: 1,
    verify: "Only facilities required by permit/NR 438 thresholds submit an inventory.",
  },
  {
    key: "AIR_MONTHLY_RECORDS",
    permitKey: "AIR_PERMIT",
    title: "Monthly air recordkeeping",
    detail: "Log throughput, operating hours, water-spray/dust control and any visible-emission observations.",
    citation: "Air permit conditions; 40 CFR 60 Subpart OOO",
    cadence: "MONTHLY",
  },
  {
    key: "SPCC_REVIEW",
    permitKey: "SPCC",
    title: "SPCC plan five-year review",
    detail: "Review and re-certify the SPCC plan (sooner after any change in storage).",
    citation: "40 CFR 112.5(b)",
    cadence: "ONE_TIME",
  },
  {
    key: "MSHA_7000_2",
    permitKey: "MSHA_LEGAL_ID",
    title: "MSHA Form 7000-2 quarterly employment report",
    detail: "Report employees and hours worked for the quarter within 15 days after quarter end.",
    citation: "30 CFR 50.30",
    cadence: "QUARTERLY",
  },
  {
    key: "MSHA_REFRESHER",
    permitKey: "MSHA_LEGAL_ID",
    title: "MSHA Part 46 annual refresher training",
    detail: "Every miner needs at least 8 hours of annual refresher training, documented on Form 5000-23.",
    citation: "30 CFR 46.8",
    cadence: "ANNUAL",
    month: 2,
    day: 28,
  },
];

function nextAnnual(from: Date, month: number, day: number): Date {
  const y = from.getUTCFullYear();
  const candidate = new Date(Date.UTC(y, month - 1, day, 17));
  return candidate > from ? candidate : new Date(Date.UTC(y + 1, month - 1, day, 17));
}

function nextQuarterEnd(from: Date): Date {
  const q = Math.floor(from.getUTCMonth() / 3);
  const end = new Date(Date.UTC(from.getUTCFullYear(), q * 3 + 3, 0, 17));
  return end > from ? end : new Date(Date.UTC(from.getUTCFullYear(), q * 3 + 6, 0, 17));
}

function nextMonthEnd(from: Date): Date {
  const end = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 17));
  return end > from ? end : new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 2, 0, 17));
}

export function nextDue(def: ObligationDef, from: Date): Date {
  switch (def.cadence) {
    case "ANNUAL":
      return nextAnnual(from, def.month ?? 12, def.day ?? 31);
    case "QUARTERLY":
      return nextQuarterEnd(from);
    case "MONTHLY":
      return nextMonthEnd(from);
    case "ONE_TIME": {
      const d = new Date(from);
      d.setUTCFullYear(d.getUTCFullYear() + 5);
      return d;
    }
  }
}

/** Obligations that follow from a set of in-scope permit keys. */
export function obligationsFor(permitKeys: string[], from = new Date()) {
  const keys = new Set(permitKeys);
  return OBLIGATIONS.filter((o) => keys.has(o.permitKey)).map((o) => ({ ...o, dueAt: nextDue(o, from) }));
}
