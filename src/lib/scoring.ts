/**
 * Lead scoring: how likely is this site to buy a $40k permitting package *now*?
 * Deterministic and explainable — every point comes with a reason shown in the UI
 * and fed to the outreach writer.
 */

export type ScoreInput = {
  commodity: string;
  mshaStatus: string;
  statusDate: Date | null;
  employees: number | null;
  portable: boolean;
  isNewSite: boolean;
  plannedExpansion: boolean | null;
  company: {
    isLargeNational: boolean;
    nationalSiteCount: number | null;
    wiSiteCount: number;
  } | null;
  signals: { type: string; detectedAt: Date }[];
  hasEmailContact: boolean;
};

export type ScoreReason = { points: number; reason: string };

const DAY = 86_400_000;

export function scoreSite(s: ScoreInput, now = new Date()): { score: number; reasons: ScoreReason[] } {
  const reasons: ScoreReason[] = [];
  const add = (points: number, reason: string) => reasons.push({ points, reason });

  if (s.mshaStatus === "ABANDONED") return { score: 0, reasons: [{ points: 0, reason: "Abandoned site" }] };

  // What they dig: industrial sand and quarries carry the heaviest permit load.
  if (s.commodity === "INDUSTRIAL_SAND") add(20, "Industrial sand: heavy air, water and reclamation scrutiny");
  else if (s.commodity === "CRUSHED_STONE") add(15, "Quarry: crushing, blasting and dewatering permits");
  else if (s.commodity === "SAND_GRAVEL") add(15, "Sand & gravel pit");
  else if (s.commodity === "DIMENSION_STONE") add(5, "Dimension stone");

  // Where they are in the life cycle.
  const recent = (d: Date | null, days: number) => !!d && now.getTime() - d.getTime() < days * DAY;
  if (s.mshaStatus === "NEW" || s.isNewSite) add(25, "New mine: full permit stack needed");
  else if (s.mshaStatus === "ACTIVE") add(10, "Active operation");
  else if (s.mshaStatus === "INTERMITTENT") add(8, "Seasonal/intermittent operation");
  else if (s.mshaStatus === "TEMP_IDLED" || s.mshaStatus === "NONPRODUCING") add(4, "Idle: possible restart");
  if (s.plannedExpansion) add(20, "Planned expansion");

  // Fresh triggers.
  const seen = new Set<string>();
  for (const sig of s.signals) {
    if (seen.has(sig.type)) continue;
    const fresh = recent(sig.detectedAt, 365);
    if (!fresh) continue;
    seen.add(sig.type);
    if (sig.type === "OWNERSHIP_CHANGE") add(25, "Ownership change in the last year: permits must transfer");
    else if (sig.type === "REACTIVATION") add(20, "Recently reactivated");
    else if (sig.type === "EXPANSION" || sig.type === "HEARING_NOTICE") add(25, "Expansion / zoning hearing on record");
    else if (sig.type === "PERMIT_APPLICATION") add(20, "Filed for WPDES coverage: actively permitting");
    else if (sig.type === "NEW_MINE" && s.mshaStatus !== "NEW" && !s.isNewSite) add(20, "Newly registered with MSHA");
  }

  // Who they are: independents without in-house environmental staff buy; nationals don't.
  const c = s.company;
  if (c?.isLargeNational || (c?.nationalSiteCount ?? 0) >= 40) {
    add(-30, "Large national producer: in-house permitting team");
  } else if (c) {
    if (c.wiSiteCount >= 4) add(12, `${c.wiSiteCount} Wisconsin sites: multi-site engagement`);
    else add(10, "Independent operator: no in-house environmental staff");
  }
  if (s.employees != null && s.employees >= 5 && s.employees <= 75) add(5, `${s.employees} employees: can afford outside help`);
  if (s.portable) add(5, "Portable plant: relocation notices and air permits");

  if (s.hasEmailContact) add(10, "Decision-maker email on file");
  else add(-10, "No contact email yet");

  const score = Math.max(0, Math.min(100, reasons.reduce((a, r) => a + r.points, 0)));
  return { score, reasons: reasons.sort((a, b) => b.points - a.points) };
}
