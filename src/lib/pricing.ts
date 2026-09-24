/**
 * Pricing engine: turns a site's permit needs into a package tier and price.
 * The $40k "Standard pit package" is the anchor; simple transfers/tune-ups sell
 * lower, quarries and multi-site / industrial sand programs sell higher.
 * Every price comes with the reasons, so you can defend it on the call.
 */
import type { NeedsItem } from "./permits/catalog";

export type TierKey = "T1" | "T2" | "T3" | "T4";

export const TIERS: Record<TierKey, { name: string; range: [number, number]; description: string }> = {
  T1: {
    name: "Compliance tune-up / transfer",
    range: [15000, 25000],
    description: "Existing site, no new disturbance: permit transfer to a new owner, bond reset, SWPPP/SPCC catch-up, annual reporting set-up.",
  },
  T2: {
    name: "Standard pit permit package",
    range: [40000, 40000],
    description: "New or expanding sand & gravel pit: reclamation plan + permit, financial assurance, conditional use, WPDES, SPCC, MSHA.",
  },
  T3: {
    name: "Quarry package",
    range: [55000, 75000],
    description: "Stone quarry or complex pit: adds blasting, crusher air permitting, dewatering / high-capacity well, wetland work.",
  },
  T4: {
    name: "Multi-site / industrial sand program",
    range: [90000, 150000],
    description: "Several sites or an industrial (frac) sand operation: program-level permitting, reclamation and bond strategy across sites.",
  },
};

export type PriceInput = {
  commodity: string;
  needs: Pick<NeedsItem, "key" | "status">[];
  isNewOrExpanding: boolean;
  wiSiteCount: number;
  standardPrice?: number; // Settings.packagePrice (anchor for T2)
};

export type PriceQuote = {
  tier: TierKey;
  tierName: string;
  price: number;
  retainerMonthly: number;
  reasons: string[];
};

const round = (n: number, to = 2500) => Math.round(n / to) * to;

export function quote(p: PriceInput): PriceQuote {
  const standard = p.standardPrice ?? 40000;
  const req = new Set(p.needs.filter((n) => n.status === "REQUIRED" || n.status === "LIKELY").map((n) => n.key));
  const reasons: string[] = [];
  let tier: TierKey;
  let price: number;

  if (p.commodity === "INDUSTRIAL_SAND" || p.wiSiteCount >= 4) {
    tier = "T4";
    const extraSites = Math.max(0, p.wiSiteCount - 4);
    price = Math.min(150000, 90000 + extraSites * 10000 + (p.commodity === "INDUSTRIAL_SAND" ? 15000 : 0));
    if (p.commodity === "INDUSTRIAL_SAND") reasons.push("Industrial sand: heavier air (NR 415.075), water and reclamation scrutiny");
    if (p.wiSiteCount >= 4) reasons.push(`${p.wiSiteCount} Wisconsin sites: one program across sites`);
  } else if (p.commodity === "CRUSHED_STONE" || req.has("BLASTING") || (req.has("HIGH_CAP_WELL") && req.has("AIR_PERMIT"))) {
    tier = "T3";
    price = 55000;
    reasons.push(p.commodity === "CRUSHED_STONE" ? "Stone quarry" : "Complex pit");
    if (req.has("BLASTING")) (price += 5000), reasons.push("+ blasting plan and monitoring");
    if (req.has("HIGH_CAP_WELL")) (price += 5000), reasons.push("+ high-capacity well approval");
    if (req.has("WETLAND_WATERWAY")) (price += 5000), reasons.push("+ wetland / waterway permitting");
    if (req.has("AIR_PERMIT")) (price += 5000), reasons.push("+ crusher air permit");
    price = Math.min(75000, price);
  } else if (p.isNewOrExpanding) {
    tier = "T2";
    price = standard;
    reasons.push("New or expanding pit: full county + WDNR stack");
    if (req.has("HIGH_CAP_WELL")) (price += 5000), reasons.push("+ high-capacity well approval");
    if (req.has("WETLAND_WATERWAY")) (price += 5000), reasons.push("+ wetland / waterway permitting");
  } else {
    tier = "T1";
    price = 15000;
    reasons.push("Existing site: transfer / catch-up scope");
    const extras = ["NR135_RECLAMATION", "FINANCIAL_ASSURANCE", "WPDES_NMM_GP", "AIR_PERMIT", "SPCC", "MSHA_LEGAL_ID"].filter((k) => req.has(k));
    price += Math.min(10000, Math.max(0, extras.length - 2) * 2500);
    if (extras.length > 2) reasons.push(`+ ${extras.length} approvals to bring current`);
  }

  const sites = Math.max(1, p.wiSiteCount);
  const retainer = Math.min(4000, Math.max(p.commodity === "INDUSTRIAL_SAND" ? 2000 : 750, 750 + (sites - 1) * 350 + (tier === "T3" ? 500 : 0)));
  return { tier, tierName: TIERS[tier].name, price: round(price), retainerMonthly: round(retainer, 50), reasons };
}
