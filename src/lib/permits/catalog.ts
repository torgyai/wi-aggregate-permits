/**
 * Wisconsin pit & quarry permit catalog and needs assessment.
 *
 * This is the domain core: it decides which approvals a site needs. It drives
 * outreach copy ("your site likely needs X"), proposal scope, the delivery
 * workplan and the compliance calendar.
 *
 * Wording is deliberately "likely / check" rather than definitive: final
 * applicability is a professional determination made on the intake data.
 * Items marked `verify` carry a note for the permitting lead to confirm
 * against the current rule text before relying on a number or date.
 */

export type SiteProfile = {
  commodity: string; // SAND_GRAVEL | CRUSHED_STONE | INDUSTRIAL_SAND | DIMENSION_STONE | OTHER
  county?: string | null;
  isNewSite?: boolean | null;
  plannedExpansion?: boolean | null;
  ownershipChange?: boolean | null;
  acreage?: number | null;
  dewatering?: boolean | null;
  washing?: boolean | null;
  crushing?: boolean | null;
  highCapWell?: boolean | null;
  nearWetlands?: boolean | null;
  oilStorageGallons?: number | null;
  blasting?: boolean | null;
  hotMixAsphalt?: boolean | null;
  portable?: boolean | null;
  mshaStatus?: string | null;
};

export type Applicability = "REQUIRED" | "LIKELY" | "CHECK" | "OPTIONAL" | "NO";

export type PermitDef = {
  key: string;
  name: string;
  shortName: string;
  agency: string;
  level: "LOCAL" | "STATE" | "FEDERAL";
  citation: string;
  summary: string;
  /** Typical calendar time from complete application to decision, in weeks. */
  typicalWeeks: [number, number];
  deliverables: string[];
  verify?: string;
  assess: (p: SiteProfile) => { status: Applicability; reason: string };
};

const isNewOrExpanding = (p: SiteProfile) => Boolean(p.isNewSite || p.plannedExpansion);
const isActive = (p: SiteProfile) => p.mshaStatus !== "ABANDONED";

export const PERMITS: PermitDef[] = [
  {
    key: "NR135_RECLAMATION",
    name: "Nonmetallic mining reclamation permit & reclamation plan",
    shortName: "NR 135 reclamation permit",
    agency: "County (or town/city/village) reclamation regulatory authority",
    level: "LOCAL",
    citation: "Wis. Admin. Code ss. NR 135.18–135.20, 135.28; Wis. Stat. ss. 295.13–295.14",
    summary:
      "Every nonmetallic mine affecting one acre or more needs a life-of-mine reclamation permit from the county (or a town/city/village with its own ordinance), backed by an approved reclamation plan and financial assurance. The authority decides 30–90 days after a complete application unless it holds a hearing; transfers to a new operator need new financial assurance and a written finding.",
    typicalWeeks: [8, 20],
    deliverables: [
      "Reclamation permit application",
      "Reclamation plan: existing conditions, post-mining land use, grading/slopes, topsoil salvage, revegetation, phasing",
      "Site maps: boundaries, phases, cross-sections, water features",
      "Reclamation cost estimate for financial assurance",
      "Response to regulatory-authority comments through approval",
    ],
    verify: "Confirm the regulatory authority (county vs. municipal ordinance) for the site's town before filing.",
    assess: (p) => {
      if (!isActive(p)) return { status: "NO", reason: "Site is abandoned in the MSHA registry." };
      if (p.acreage != null && p.acreage < 1)
        return { status: "CHECK", reason: "Sites affecting under 1 acre over the life of the mine are exempt (NR 135.02)." };
      if (p.isNewSite) return { status: "REQUIRED", reason: "New sites need a reclamation permit before mining starts." };
      if (p.plannedExpansion)
        return { status: "REQUIRED", reason: "Expanding beyond the permitted area needs a permit modification and updated plan." };
      if (p.ownershipChange)
        return {
          status: "REQUIRED",
          reason: "A permit transfer (NR 135.28) needs the new operator's financial assurance and a written finding by the authority.",
        };
      return { status: "LIKELY", reason: "Life-of-mine permit: plan amendments, bond adjustments and the Jan 31 annual report." };
    },
  },
  {
    key: "FINANCIAL_ASSURANCE",
    name: "Reclamation financial assurance (bond / letter of credit)",
    shortName: "Financial assurance",
    agency: "County reclamation regulatory authority",
    level: "LOCAL",
    citation: "Wis. Admin. Code s. NR 135.40",
    summary:
      "Financial assurance sized to the regulatory authority's cost to reclaim the disturbed area. Over-estimates tie up capital; under-estimates get sent back.",
    typicalWeeks: [2, 6],
    deliverables: [
      "Per-phase unit-cost reclamation estimate (grading, topsoil, seeding, mobilization)",
      "Bond / LOC form coordination with surety",
      "Phase-release strategy to reduce the bonded amount as areas are reclaimed",
    ],
    assess: (p) =>
      isNewOrExpanding(p) || p.ownershipChange
        ? { status: "REQUIRED", reason: "Financial assurance must be in place before new disturbance or on transfer." }
        : { status: "CHECK", reason: "Review whether the current bond matches today's disturbed acreage." },
  },
  {
    key: "LOCAL_ZONING",
    name: "Conditional use / zoning approval",
    shortName: "Conditional use permit",
    agency: "County or town zoning (Planning & Zoning committee / Board of Adjustment)",
    level: "LOCAL",
    citation: "Local zoning ordinance; Wis. Stat. s. 59.69 (county), ss. 60.61–60.62 (town), s. 66.0441 (quarries)",
    summary:
      "Most zoned jurisdictions treat mineral extraction as a conditional use: application, operations plan, public hearing and conditions (hours, haul routes, setbacks, screening).",
    typicalWeeks: [6, 16],
    deliverables: [
      "CUP application and operations narrative (hours, equipment, truck counts, haul routes)",
      "Site plan with setbacks, berms, screening, access",
      "Neighbor-impact responses: noise, dust, traffic, groundwater, property values",
      "Hearing preparation and presentation materials",
      "Negotiated conditions review",
    ],
    verify:
      "Zoning status varies by town; unzoned towns may rely on a licensing ordinance. Under s. 66.0441 an active quarry can't be made to get a new CUP/license unless the ordinance predates its operations.",
    assess: (p) =>
      isNewOrExpanding(p)
        ? { status: "REQUIRED", reason: "New or expanded extraction almost always needs local land-use approval." }
        : { status: "CHECK", reason: "Confirm existing approvals cover current hours, depth and footprint." },
  },
  {
    key: "WPDES_NMM_GP",
    name: "WPDES Mineral (Nonmetallic) Mining and/or Processing General Permit coverage",
    shortName: "WPDES nonmetallic mining permit",
    agency: "Wisconsin DNR — Water Quality",
    level: "STATE",
    citation: "WPDES General Permit WI-0046515-07-2; Wis. Admin. Code ch. NR 216",
    summary:
      "Covers wash water, pit dewatering, dust-control water and storm water discharges from sand, gravel, stone and industrial sand operations. Requires an electronic NOI, a storm water pollution prevention plan, quarterly inspections, sampling and eDMRs.",
    typicalWeeks: [2, 8],
    deliverables: [
      "Notice of Intent for general permit coverage",
      "Storm Water Pollution Prevention Plan (SWPPP) with site map",
      "Dewatering / wash-water discharge description and BMPs",
      "Inspection and monitoring schedule",
    ],
    verify: "Current reissuance -07-2 took effect Dec 31, 2024; confirm the expiration date on the permit cover page.",
    assess: (p) => {
      if (!isActive(p)) return { status: "NO", reason: "Site is abandoned." };
      if (p.dewatering || p.washing)
        return {
          status: "REQUIRED",
          reason: "Pit dewatering or wash-water discharges need WPDES coverage with process-water conditions.",
        };
      if (p.isNewSite || p.ownershipChange)
        return { status: "REQUIRED", reason: "Storm water discharges from an operating pit need permit coverage in the operator's name." };
      return { status: "LIKELY", reason: "Most operating pits and quarries discharge storm water and need coverage." };
    },
  },
  {
    key: "AIR_PERMIT",
    name: "Air permit for crushing / screening (nonmetallic mineral processing)",
    shortName: "Air permit",
    agency: "Wisconsin DNR — Air Management",
    level: "STATE",
    citation: "Wis. Admin. Code chs. NR 406, NR 407 (incl. s. NR 407.105), NR 415.075, NR 440.688; 40 CFR 60 Subpart OOO",
    summary:
      "Crushers, screens and conveyors are regulated air sources. Most crushing plants fit WDNR's Crushing Plants General Construction and Operation Permit (15-day decision) or a registration permit; larger plants need site-specific permits. Federal NSPS Subpart OOO (fixed plants over 25 tph, portable over 150 tph) adds opacity tests and inspections. Portable plants must notify WDNR at least 20 days before each move.",
    typicalWeeks: [4, 26],
    deliverables: [
      "Applicability and emissions calculation (throughput, equipment list, control devices)",
      "Crushing Plants General Permit application (Form 4530-141) or registration/site-specific application as applicable",
      "NSPS Subpart OOO notifications and opacity test coordination",
      "Fugitive dust control plan",
      "Portable-source relocation notice (Form 4500-025, 20 days before each move)",
    ],
    verify:
      "Adding crushers/screens at a site that already holds an operation permit may qualify for the NR 406.04(1)(zc) exemption claim instead.",
    assess: (p) => {
      if (p.hotMixAsphalt)
        return { status: "REQUIRED", reason: "A hot-mix asphalt plant is a significant air source needing its own permit." };
      if (p.crushing)
        return { status: "REQUIRED", reason: "Crushing/screening equipment needs WDNR air permit coverage." };
      if (p.crushing == null && (p.commodity === "CRUSHED_STONE" || p.portable))
        return { status: "LIKELY", reason: "Quarries and portable plants typically run crushers." };
      return { status: "CHECK", reason: "Needed if a crusher or screen plant operates on site." };
    },
  },
  {
    key: "HIGH_CAP_WELL",
    name: "High capacity well approval",
    shortName: "High capacity well approval",
    agency: "Wisconsin DNR — Drinking & Groundwater",
    level: "STATE",
    citation: "Wis. Stat. s. 281.34(1)(b); Wis. Admin. Code ch. NR 812",
    summary:
      "Wells on one property with a combined capacity over 100,000 gallons per day (about 70 gpm) need DNR approval before construction — including high-capacity dewatering wells (Form 3300-258).",
    typicalWeeks: [6, 20],
    deliverables: [
      "Capacity determination for all wells/pumps on the property",
      "High capacity well application with water-use justification",
      "Impact screening (nearby wells, springs, surface waters)",
    ],
    verify: "Open-pit sump pumping may not meet the statutory 'well' definition; confirm with WDNR for the site.",
    assess: (p) => {
      if (p.highCapWell) return { status: "REQUIRED", reason: "Property well capacity is over the 100,000 gpd threshold." };
      if (p.dewatering || p.washing)
        return { status: "CHECK", reason: "Dewatering or wash plants can push property pumping capacity over 100,000 gpd." };
      return { status: "NO", reason: "No significant water withdrawal reported." };
    },
  },
  {
    key: "WETLAND_WATERWAY",
    name: "Wetland / waterway permits",
    shortName: "Wetland & waterway permits",
    agency: "Wisconsin DNR (ch. 30 / s. 281.36) and U.S. Army Corps of Engineers (CWA s. 404)",
    level: "STATE",
    citation: "Wis. Stat. ch. 30 and s. 281.36; Wis. Admin. Code ch. NR 340; 33 U.S.C. 1344",
    summary:
      "Fill, grading or excavation in wetlands or near navigable waters needs state (and often federal) permits; mining ponds within 500 ft of a waterway fall under NR 340. Starts with a wetland delineation.",
    typicalWeeks: [8, 30],
    deliverables: [
      "Wetland screening and delineation coordination",
      "Avoidance/minimization site layout",
      "Joint state/federal permit application if impacts can't be avoided",
    ],
    assess: (p) =>
      p.nearWetlands
        ? { status: "REQUIRED", reason: "Wetlands or waterways are on or next to the planned disturbance." }
        : isNewOrExpanding(p)
          ? { status: "CHECK", reason: "New disturbance should be screened against wetland inventory maps." }
          : { status: "NO", reason: "No new disturbance near mapped wetlands reported." },
  },
  {
    key: "ER_REVIEW",
    name: "Endangered resources review",
    shortName: "Endangered resources review",
    agency: "Wisconsin DNR — Natural Heritage Conservation",
    level: "STATE",
    citation: "Wis. Stat. s. 29.604",
    summary:
      "Screens new disturbance against the Natural Heritage Inventory for protected species and habitats. WDNR encourages it for nonmetallic mining, and it heads off late surprises during county and WDNR review.",
    typicalWeeks: [2, 6],
    deliverables: ["ER review request and response", "Avoidance measures (timing windows, buffers) if species are flagged"],
    assess: (p) =>
      isNewOrExpanding(p)
        ? { status: "LIKELY", reason: "New or expanded disturbance is typically screened before approval." }
        : { status: "NO", reason: "No new disturbance." },
  },
  {
    key: "SPCC",
    name: "Spill Prevention, Control & Countermeasure (SPCC) plan",
    shortName: "SPCC plan",
    agency: "U.S. EPA",
    level: "FEDERAL",
    citation: "40 CFR 112.1(d)(2)(ii), 112.3(g)",
    summary:
      "Sites storing more than 1,320 gallons of oil in aboveground containers of 55 gallons or more (fuel tanks, equipment oil) need a written SPCC plan, secondary containment and inspections.",
    typicalWeeks: [1, 4],
    deliverables: ["SPCC plan (self-certified or PE-certified by volume)", "Containment and inspection checklist"],
    assess: (p) => {
      if (p.oilStorageGallons != null)
        return p.oilStorageGallons > 1320
          ? { status: "REQUIRED", reason: `${p.oilStorageGallons.toLocaleString()} gal of aboveground oil exceeds 1,320 gal.` }
          : { status: "NO", reason: "Aboveground oil storage is under 1,320 gal." };
      return { status: "CHECK", reason: "Most pits with a fuel tank and a loader fleet cross 1,320 gallons." };
    },
  },
  {
    key: "MSHA_LEGAL_ID",
    name: "MSHA legal identity report & Part 46 training plan",
    shortName: "MSHA legal ID + training plan",
    agency: "U.S. Mine Safety and Health Administration",
    level: "FEDERAL",
    citation: "30 CFR 41.11–41.12; 30 CFR 56.1000; 30 CFR Part 46",
    summary:
      "New mines and new operators notify the MSHA district before starting and file a Legal Identity Report (Form 2000-7) within 30 days of opening or any change. Surface aggregate operations need a Part 46 training plan (24 h new-miner, 8 h annual refresher).",
    typicalWeeks: [1, 3],
    deliverables: [
      "Opening notification to the MSHA district",
      "Legal Identity Report (Form 2000-7)",
      "Part 46 training plan and records templates",
    ],
    assess: (p) =>
      p.isNewSite || p.ownershipChange
        ? { status: "REQUIRED", reason: "New mine or new operator must file with MSHA." }
        : { status: "NO", reason: "Existing registration." },
  },
  {
    key: "BLASTING",
    name: "Blasting compliance",
    shortName: "Blasting compliance",
    agency: "Wisconsin DSPS and local ordinance",
    level: "STATE",
    citation: "Wis. Admin. Code ch. SPS 307",
    summary:
      "Blasting requires a licensed blaster (Class 5–7 in a municipality), ground-vibration and airblast limits with seismograph records on every blast (SPS 307.44), and often pre-blast surveys and town notice rules.",
    typicalWeeks: [2, 6],
    deliverables: ["Blasting plan", "Pre-blast survey scope", "Vibration and air-blast monitoring protocol"],
    assess: (p) =>
      p.blasting
        ? { status: "REQUIRED", reason: "Blasting is planned." }
        : p.commodity === "CRUSHED_STONE" && p.blasting == null
          ? { status: "LIKELY", reason: "Stone quarries typically blast." }
          : { status: "NO", reason: "No blasting reported." },
  },
  {
    key: "MARKETABLE_DEPOSIT",
    name: "Marketable nonmetallic mineral deposit registration",
    shortName: "Deposit registration",
    agency: "County / municipal zoning authority",
    level: "LOCAL",
    citation: "Wis. Stat. s. 295.20; Wis. Admin. Code ch. NR 135 subch. IV",
    summary:
      "Registers a proven deposit so future zoning changes can't block mining it. Protects the value of reserves the operator owns or leases.",
    typicalWeeks: [4, 10],
    deliverables: ["Professional geologist/engineer certification of the deposit", "Registration application and legal description"],
    verify: "Registration lasts 10 years; renewable once without re-review, and indefinitely while mining is active.",
    assess: (p) =>
      isNewOrExpanding(p)
        ? { status: "OPTIONAL", reason: "Worth registering reserves while the site is being permitted." }
        : { status: "OPTIONAL", reason: "Protects unmined reserves from future zoning changes." },
  },
];

export const PERMIT_BY_KEY = Object.fromEntries(PERMITS.map((p) => [p.key, p]));

export type NeedsItem = {
  key: string;
  name: string;
  shortName: string;
  agency: string;
  level: PermitDef["level"];
  citation: string;
  status: Applicability;
  reason: string;
  typicalWeeks: [number, number];
  deliverables: string[];
  verify?: string;
};

const RANK: Record<Applicability, number> = { REQUIRED: 0, LIKELY: 1, CHECK: 2, OPTIONAL: 3, NO: 4 };

export function assessNeeds(profile: SiteProfile): NeedsItem[] {
  return PERMITS.map((def) => {
    const { status, reason } = def.assess(profile);
    return {
      key: def.key,
      name: def.name,
      shortName: def.shortName,
      agency: def.agency,
      level: def.level,
      citation: def.citation,
      status,
      reason,
      typicalWeeks: def.typicalWeeks,
      deliverables: def.deliverables,
      verify: def.verify,
    };
  }).sort((a, b) => RANK[a.status] - RANK[b.status]);
}

/** Items that belong in scope (and in outreach copy). */
export function inScope(items: NeedsItem[]): NeedsItem[] {
  return items.filter((i) => i.status === "REQUIRED" || i.status === "LIKELY" || i.status === "CHECK");
}

/** Critical path: permits run in parallel, so the long pole is the slowest required item. */
export function estimateTimelineWeeks(items: NeedsItem[]): [number, number] {
  const req = items.filter((i) => i.status === "REQUIRED" || i.status === "LIKELY");
  if (!req.length) return [4, 8];
  const lo = Math.max(...req.map((i) => i.typicalWeeks[0]));
  const hi = Math.max(...req.map((i) => i.typicalWeeks[1]));
  // +2 weeks up front for intake, site data and drafting.
  return [lo + 2, hi + 2];
}

/** Profile flags implied by fresh buying signals (last 12 months). */
export function signalFlags(signals: { type: string; detectedAt: Date }[], now = new Date()) {
  const fresh = signals.filter((s) => now.getTime() - s.detectedAt.getTime() < 365 * 86_400_000);
  return {
    ownershipChange: fresh.some((s) => s.type === "OWNERSHIP_CHANGE"),
    plannedExpansion: fresh.some((s) => s.type === "EXPANSION" || s.type === "HEARING_NOTICE") || undefined,
  };
}

/** Build a SiteProfile from a DB Site row (+ optional client intake overrides). */
export function profileFromSite(
  site: {
    commodity: string;
    county: string | null;
    isNewSite: boolean;
    plannedExpansion: boolean | null;
    acreage: number | null;
    dewatering: boolean | null;
    washing: boolean | null;
    crushing: boolean | null;
    highCapWell: boolean | null;
    nearWetlands: boolean | null;
    oilStorageGallons: number | null;
    blasting: boolean | null;
    hotMixAsphalt: boolean | null;
    portable: boolean;
    mshaStatus: string;
  },
  extra: { ownershipChange?: boolean; plannedExpansion?: boolean } = {},
): SiteProfile {
  return {
    commodity: site.commodity,
    county: site.county,
    isNewSite: site.isNewSite || site.mshaStatus === "NEW",
    // An explicit "no" on the site record wins over a signal.
    plannedExpansion: site.plannedExpansion ?? extra.plannedExpansion ?? null,
    ownershipChange: extra.ownershipChange ?? false,
    acreage: site.acreage,
    dewatering: site.dewatering,
    washing: site.washing,
    crushing: site.crushing,
    highCapWell: site.highCapWell,
    nearWetlands: site.nearWetlands,
    oilStorageGallons: site.oilStorageGallons,
    blasting: site.blasting,
    hotMixAsphalt: site.hotMixAsphalt,
    portable: site.portable,
    mshaStatus: site.mshaStatus,
  };
}
