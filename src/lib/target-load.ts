import { db } from "./db";
import { normalizeCompanyName } from "./msha";
import { rescoreSites } from "./prospecting";
import { TARGET_ACCOUNTS } from "./target-accounts";

/**
 * Load the researched target accounts as companies + a primary site each.
 * Idempotent. Adds no contacts, so nothing is ever emailed until you add a
 * decision maker yourself.
 */
export async function loadTargetAccounts() {
  let created = 0;
  let updated = 0;
  for (const t of TARGET_ACCOUNTS) {
    const norm = normalizeCompanyName(t.name);
    const data = {
      isTargetAccount: true,
      region: t.region,
      fitScore: t.fit,
      pricingTier: t.tier,
      suggestedPrice: t.price,
      suggestedRetainer: t.retainer,
      outreachAngle: t.angle,
      sources: t.sources.join("\n"),
      notes: [t.what, t.size, t.trigger && `Trigger: ${t.trigger}`, `Scope: ${t.scope}`, t.caution && `Caution: ${t.caution}`].filter(Boolean).join("\n"),
      website: t.website ? `https://${t.website}` : undefined,
      domain: t.website,
      city: t.hq,
      state: "WI",
      isLargeNational: t.ownership === "National / large",
    };
    const existing = await db.company.findUnique({ where: { normalizedName: norm } });
    const company = existing
      ? await db.company.update({ where: { id: existing.id }, data })
      : await db.company.create({ data: { ...data, name: t.name, normalizedName: norm, source: "RESEARCH" } });
    existing ? updated++ : created++;

    let site = await db.site.findFirst({ where: { companyId: company.id }, orderBy: { score: "desc" } });
    if (!site) {
      site = await db.site.create({
        data: {
          name: `${t.name.replace(/,? (LLC|Inc\.?|Co\.?|Ltd\.?|Company|Corporation)$/i, "")} — primary site`,
          companyId: company.id,
          county: t.county,
          commodity: t.commodity,
          mshaStatus: t.triggerType === "NEW_MINE" ? "NEW" : "ACTIVE",
          isNewSite: t.triggerType === "NEW_MINE",
          plannedExpansion: t.triggerType === "EXPANSION" ? true : null,
          blasting: t.commodity === "CRUSHED_STONE" ? null : undefined,
        },
      });
    }
    if (t.trigger) {
      await db.signal.upsert({
        where: { externalKey: `target:${t.n}` },
        create: {
          externalKey: `target:${t.n}`,
          siteId: site.id,
          companyId: company.id,
          type: t.triggerType ?? "MANUAL",
          title: t.trigger.slice(0, 180),
          detail: t.sources[0],
          weight: 20,
        },
        update: { title: t.trigger.slice(0, 180) },
      });
    }
  }
  await rescoreSites();
  return { summary: `Target accounts: ${created} added, ${updated} updated (no contacts added, nothing emailed).`, created, updated };
}
