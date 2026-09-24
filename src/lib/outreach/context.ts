import { db } from "../db";
import { COMMODITY_LABEL } from "../enums";
import { assessNeeds, inScope, profileFromSite, estimateTimelineWeeks, signalFlags, type NeedsItem } from "../permits/catalog";
import type { Settings } from "../settings";

export type Angle = "OWNERSHIP_CHANGE" | "NEW_MINE" | "EXPANSION" | "REACTIVATION" | "GENERAL";

export type LeadContext = {
  contact: { id: string; firstName: string | null; lastName: string | null; title: string | null; email: string };
  company: { id: string; name: string; wiSiteCount: number };
  site: {
    id: string;
    name: string;
    county: string | null;
    municipality: string | null;
    commodity: string;
    commodityLabel: string;
    mshaStatus: string;
    portable: boolean;
    employees: number | null;
  } | null;
  angle: Angle;
  signalSummary: string | null;
  needs: NeedsItem[];
  timelineWeeks: [number, number];
  sender: { name: string; title: string; company: string; phone: string; bookingUrl: string; website: string };
  offer: { name: string; price: number; retainerMonthly: number };
};

const ANGLE_PRIORITY: Angle[] = ["OWNERSHIP_CHANGE", "NEW_MINE", "EXPANSION", "REACTIVATION"];

export function pickAngle(signals: { type: string; detectedAt: Date }[], now = new Date()): Angle {
  const fresh = signals.filter((s) => now.getTime() - s.detectedAt.getTime() < 365 * 86_400_000);
  for (const a of ANGLE_PRIORITY) {
    if (fresh.some((s) => s.type === a || (a === "EXPANSION" && s.type === "HEARING_NOTICE"))) return a;
  }
  return "GENERAL";
}

export async function buildLeadContext(contactId: string, siteId: string | null, settings: Settings): Promise<LeadContext> {
  const contact = await db.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: { company: { include: { _count: { select: { sites: true } } } } },
  });
  const site = siteId
    ? await db.site.findUnique({ where: { id: siteId }, include: { signals: true } })
    : await db.site.findFirst({
        where: { companyId: contact.companyId },
        orderBy: { score: "desc" },
        include: { signals: true },
      });
  // This site's signals plus company-wide ones (not signals from the operator's other pits).
  const companySignals = await db.signal.findMany({ where: { companyId: contact.companyId, siteId: null } });
  const signals = [...(site?.signals ?? []), ...companySignals];
  const angle = pickAngle(signals);
  const lead = signals
    .filter((s) => angle !== "GENERAL" && (s.type === angle || (angle === "EXPANSION" && s.type === "HEARING_NOTICE")))
    .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())[0];

  const flags = signalFlags(signals);
  const profile = site ? profileFromSite(site, flags) : { commodity: "SAND_GRAVEL", ...flags };
  const needs = inScope(assessNeeds(profile));

  return {
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title,
      email: contact.email!,
    },
    company: { id: contact.company.id, name: contact.company.name, wiSiteCount: contact.company._count.sites },
    site: site
      ? {
          id: site.id,
          name: site.name,
          county: site.county,
          municipality: site.municipality,
          commodity: site.commodity,
          commodityLabel: COMMODITY_LABEL[site.commodity] ?? "aggregate",
          mshaStatus: site.mshaStatus,
          portable: site.portable,
          employees: site.employees,
        }
      : null,
    angle,
    signalSummary: lead ? [lead.title, lead.detail].filter(Boolean).join(" — ") : null,
    needs,
    timelineWeeks: estimateTimelineWeeks(needs),
    sender: {
      name: settings.senderName,
      title: settings.senderTitle,
      company: settings.companyName,
      phone: settings.phone,
      bookingUrl: settings.bookingUrl,
      website: settings.website,
    },
    offer: { name: settings.packageName, price: settings.packagePrice, retainerMonthly: settings.retainerMonthly },
  };
}
