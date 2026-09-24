import { db } from "./db";
import { assessNeeds, profileFromSite, signalFlags } from "./permits/catalog";
import { quote, type PriceQuote } from "./pricing";
import type { Settings } from "./settings";

/** Price a site with the pricing engine (needs + signals + operator size). */
export async function quoteForSite(siteId: string, s: Settings): Promise<PriceQuote> {
  const site = await db.site.findUniqueOrThrow({
    where: { id: siteId },
    include: { signals: true, company: { select: { id: true, _count: { select: { sites: true } } } } },
  });
  const companySignals = site.companyId
    ? await db.signal.findMany({ where: { companyId: site.companyId, siteId: null } })
    : [];
  const flags = signalFlags([...site.signals, ...companySignals]);
  const profile = profileFromSite(site, flags);
  return quote({
    commodity: site.commodity,
    needs: assessNeeds(profile),
    isNewOrExpanding: Boolean(profile.isNewSite || profile.plannedExpansion),
    wiSiteCount: site.company?._count.sites ?? 1,
    standardPrice: s.packagePrice,
  });
}

/** Refresh a deal's price from the engine unless someone set it by hand (or it's a researched target account). */
export async function repriceDeal(dealId: string, s: Settings) {
  const deal = await db.deal.findUniqueOrThrow({ where: { id: dealId }, include: { company: true } });
  if (deal.priceOverridden) return deal;
  if (deal.company.suggestedPrice) {
    return db.deal.update({
      where: { id: dealId },
      data: {
        value: deal.company.suggestedPrice,
        pricingTier: deal.company.pricingTier,
        retainerMonthly: deal.company.suggestedRetainer || null,
        priceOverridden: true,
      },
    });
  }
  if (!deal.siteId) return deal;
  const q = await quoteForSite(deal.siteId, s);
  return db.deal.update({ where: { id: dealId }, data: { value: q.price, pricingTier: q.tier, retainerMonthly: q.retainerMonthly } });
}
