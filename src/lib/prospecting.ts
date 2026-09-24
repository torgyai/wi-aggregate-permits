import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { findOrganization, revealPerson, searchBuyers, apolloEnabled, titleRank } from "./apollo";
import { parseCsvObjects, pick } from "./csv";
import { titleCase } from "./format";
import {
  DEFAULT_MSHA_MINES_URL,
  isLargeNationalName,
  normalizeCompanyName,
  parseMinesText,
  readMinesArchive,
  type MshaSite,
} from "./msha";
import { scoreSite } from "./scoring";
import { getSettings } from "./settings";

const DAY = 86_400_000;

// ---------------------------------------------------------------- MSHA sync

export async function downloadMines(url = process.env.MSHA_MINES_URL || DEFAULT_MSHA_MINES_URL): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; StratexAggregate/1.0)" } });
  if (!res.ok) throw new Error(`MSHA download failed: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

type SyncResult = {
  summary: string;
  parsed: number;
  created: number;
  updated: number;
  signals: number;
  companies: number;
};

/**
 * Upsert Wisconsin aggregate sites from the MSHA Mines file and emit signals for
 * what changed since the last sync: new mines, operator changes, reactivations.
 */
export async function syncMsha(opts: { bytes?: Uint8Array; now?: Date } = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const bytes = opts.bytes ?? (await downloadMines());
  const { sites, controllerSiteCounts } = parseMinesText(await readMinesArchive(bytes));

  const firstImport = (await db.site.count({ where: { mshaMineId: { not: null } } })) === 0;

  // Companies, keyed by normalised operator name.
  const companies = new Map(
    (await db.company.findMany({ select: { id: true, normalizedName: true, mshaOperatorIds: true } })).map((c) => [
      c.normalizedName,
      c,
    ]),
  );
  const byOperator = new Map<string, MshaSite[]>();
  for (const s of sites) {
    const key = normalizeCompanyName(s.operatorName);
    if (!key) continue;
    byOperator.set(key, [...(byOperator.get(key) ?? []), s]);
  }
  let companiesCreated = 0;
  for (const [key, group] of byOperator) {
    const first = group[0];
    const national = Math.max(0, ...group.map((g) => (g.controllerId ? controllerSiteCounts.get(g.controllerId) ?? 0 : 0)));
    const large = isLargeNationalName(first.controllerName) || isLargeNationalName(first.operatorName) || national >= 40;
    const operatorIds = Array.from(new Set(group.map((g) => g.operatorId).filter((x): x is string => !!x)));
    const existing = companies.get(key);
    if (existing) {
      await db.company.update({
        where: { id: existing.id },
        data: {
          controllerName: first.controllerName,
          nationalSiteCount: national || null,
          isLargeNational: large,
          mshaOperatorIds: Array.from(new Set([...existing.mshaOperatorIds, ...operatorIds])),
        },
      });
    } else {
      const created = await db.company.create({
        data: {
          name: titleCase(first.operatorName),
          normalizedName: key,
          controllerName: first.controllerName,
          mshaOperatorIds: operatorIds,
          nationalSiteCount: national || null,
          isLargeNational: large,
          state: "WI",
          city: first.nearestTown ? titleCase(first.nearestTown) : null,
          source: "MSHA",
        },
        select: { id: true, normalizedName: true, mshaOperatorIds: true },
      });
      companies.set(key, created);
      companiesCreated++;
    }
  }

  const existingSites = new Map(
    (
      await db.site.findMany({
        where: { mshaMineId: { not: null } },
        select: { id: true, mshaMineId: true, companyId: true, mshaStatus: true, name: true, employees: true },
      })
    ).map((s) => [s.mshaMineId!, s]),
  );

  let created = 0;
  let updated = 0;
  const signals: Prisma.SignalCreateManyInput[] = [];

  for (const s of sites) {
    const company = companies.get(normalizeCompanyName(s.operatorName));
    const fields = {
      name: titleCase(s.name),
      companyId: company?.id ?? null,
      county: s.county,
      countyFips: s.countyFips,
      municipality: s.nearestTown ? titleCase(s.nearestTown) : null,
      latitude: s.latitude,
      longitude: s.longitude,
      commodity: s.commodity,
      sicDescription: s.sicDescription,
      mineType: s.mineType,
      mshaStatus: s.mshaStatus,
      statusDate: s.statusDate,
      employees: s.employees,
      portable: s.portable,
    };
    const prev = existingSites.get(s.mshaMineId);
    const recentOwnerChange = s.controllerSince && now.getTime() - s.controllerSince.getTime() < 365 * DAY;

    if (!prev) {
      const site = await db.site.create({
        data: { ...fields, mshaMineId: s.mshaMineId, isNewSite: s.mshaStatus === "NEW" },
        select: { id: true },
      });
      created++;
      if (s.mshaStatus === "NEW" || !firstImport) {
        signals.push({
          siteId: site.id,
          companyId: company?.id,
          type: "NEW_MINE",
          externalKey: `msha:new:${s.mshaMineId}`,
          title: `New MSHA mine registered: ${fields.name}`,
          detail: `${s.sicDescription ?? s.commodity} in ${s.county ?? "WI"} County (MSHA ${s.mshaMineId}).`,
          weight: 20,
        });
      }
      if (recentOwnerChange) {
        signals.push({
          siteId: site.id,
          companyId: company?.id,
          type: "OWNERSHIP_CHANGE",
          externalKey: `msha:ctrl:${s.mshaMineId}:${s.controllerSince!.toISOString().slice(0, 10)}`,
          title: `Controller change: ${s.controllerName ?? s.operatorName}`,
          detail: `MSHA shows the current controller since ${s.controllerSince!.toISOString().slice(0, 10)}.`,
          weight: 25,
          detectedAt: s.controllerSince!,
        });
      }
      continue;
    }

    const changed =
      prev.companyId !== fields.companyId ||
      prev.mshaStatus !== fields.mshaStatus ||
      prev.name !== fields.name ||
      prev.employees !== fields.employees;
    if (!changed) continue;

    if (prev.companyId && fields.companyId && prev.companyId !== fields.companyId) {
      signals.push({
        siteId: prev.id,
        companyId: fields.companyId,
        type: "OWNERSHIP_CHANGE",
        externalKey: `msha:op:${s.mshaMineId}:${fields.companyId}`,
        title: `Operator changed to ${titleCase(s.operatorName)}`,
        detail: "Reclamation permit, WPDES coverage, air permits and the MSHA legal ID all need to follow the new operator.",
        weight: 25,
      });
    }
    if (prev.mshaStatus !== fields.mshaStatus) {
      const wasIdle = ["ABANDONED", "TEMP_IDLED", "NONPRODUCING", "INTERMITTENT"].includes(prev.mshaStatus);
      const reactivated = wasIdle && fields.mshaStatus === "ACTIVE";
      signals.push({
        siteId: prev.id,
        companyId: fields.companyId,
        type: reactivated ? "REACTIVATION" : "STATUS_CHANGE",
        externalKey: `msha:status:${s.mshaMineId}:${fields.mshaStatus}:${(s.statusDate ?? now).toISOString().slice(0, 10)}`,
        title: `${fields.name}: ${prev.mshaStatus.toLowerCase()} → ${fields.mshaStatus.toLowerCase()}`,
        weight: reactivated ? 20 : 5,
      });
    }
    await db.site.update({ where: { id: prev.id }, data: fields });
    updated++;
  }

  if (signals.length) await db.signal.createMany({ data: signals, skipDuplicates: true });
  const rescored = await rescoreSites();

  return {
    summary: `MSHA: ${sites.length} WI aggregate sites parsed, ${created} new, ${updated} changed, ${signals.length} signals, ${companiesCreated} new companies, ${rescored} rescored.`,
    parsed: sites.length,
    created,
    updated,
    signals: signals.length,
    companies: companiesCreated,
  };
}

// ---------------------------------------------------------------- Scoring

/** Recompute scores (all sites, or a subset). Returns how many changed. */
export async function rescoreSites(siteIds?: string[], now = new Date()): Promise<number> {
  const sites = await db.site.findMany({
    where: siteIds ? { id: { in: siteIds } } : undefined,
    include: {
      signals: { select: { type: true, detectedAt: true } },
      company: {
        select: {
          isLargeNational: true,
          nationalSiteCount: true,
          _count: { select: { sites: true } },
          contacts: { where: { email: { not: null }, doNotContact: false }, select: { id: true }, take: 1 },
          signals: { where: { siteId: null }, select: { type: true, detectedAt: true } },
        },
      },
    },
  });
  let changed = 0;
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const s of sites) {
    const { score, reasons } = scoreSite(
      {
        commodity: s.commodity,
        mshaStatus: s.mshaStatus,
        statusDate: s.statusDate,
        employees: s.employees,
        portable: s.portable,
        isNewSite: s.isNewSite,
        plannedExpansion: s.plannedExpansion,
        company: s.company
          ? {
              isLargeNational: s.company.isLargeNational,
              nationalSiteCount: s.company.nationalSiteCount,
              wiSiteCount: s.company._count.sites,
            }
          : null,
        signals: [...s.signals, ...(s.company?.signals ?? [])],
        hasEmailContact: (s.company?.contacts.length ?? 0) > 0,
      },
      now,
    );
    if (score !== s.score || !s.scoredAt) {
      changed++;
      updates.push(
        db.site.update({
          where: { id: s.id },
          data: { score, scoreReasons: reasons as unknown as Prisma.InputJsonValue, scoredAt: now },
        }),
      );
    }
  }
  for (let i = 0; i < updates.length; i += 200) await db.$transaction(updates.slice(i, i + 200));
  return changed;
}

// ---------------------------------------------------------------- CSV contacts

export type CsvImportResult = {
  summary: string;
  contacts: number;
  matchedCompanies: number;
  newCompanies: number;
  skipped: number;
};

const domainOf = (v?: string) =>
  v
    ?.toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0] || undefined;

/**
 * Import contacts from Apollo / Apify "leads finder" / generic CSV exports and
 * attach them to MSHA operators by domain or normalised company name.
 */
export async function importContactsCsv(text: string): Promise<CsvImportResult> {
  const rows = parseCsvObjects(text);
  const companies = await db.company.findMany({ select: { id: true, normalizedName: true, domain: true } });
  const byName = new Map(companies.map((c) => [c.normalizedName, c.id]));
  const byDomain = new Map(companies.filter((c) => c.domain).map((c) => [c.domain!, c.id]));
  const suppressed = new Set((await db.suppression.findMany({ select: { email: true } })).map((s) => s.email));

  let contacts = 0;
  let matched = 0;
  let newCompanies = 0;
  let skipped = 0;
  const touched = new Set<string>();

  for (const r of rows) {
    const email = (pick(r, "email", "work_email", "email_address") ?? pick(r, "personal_email"))?.toLowerCase();
    const companyName = pick(r, "company_name", "company", "organization_name", "account_name");
    if (!email || !email.includes("@") || !companyName || suppressed.has(email)) {
      skipped++;
      continue;
    }
    const domain = domainOf(pick(r, "company_domain", "website", "company_website", "domain"));
    const norm = normalizeCompanyName(companyName);
    let companyId = (domain && byDomain.get(domain)) || byName.get(norm);
    if (companyId) matched++;
    else {
      const c = await db.company.create({
        data: {
          name: companyName,
          normalizedName: norm,
          domain,
          website: pick(r, "company_website", "website"),
          phone: pick(r, "company_phone"),
          city: pick(r, "company_city", "city"),
          state: pick(r, "company_state", "state"),
          street: pick(r, "company_street_address"),
          zip: pick(r, "company_postal_code"),
          source: "CSV",
        },
      });
      companyId = c.id;
      byName.set(norm, c.id);
      if (domain) byDomain.set(domain, c.id);
      newCompanies++;
    }
    if (domain) await db.company.updateMany({ where: { id: companyId, domain: null }, data: { domain } });

    const [first, ...rest] = (pick(r, "full_name", "name") ?? "").split(" ");
    await db.contact.upsert({
      where: { email },
      create: {
        companyId,
        email,
        firstName: pick(r, "first_name") ?? (first || null),
        lastName: pick(r, "last_name") ?? (rest.join(" ") || null),
        title: pick(r, "job_title", "title"),
        phone: pick(r, "mobile_number", "phone", "mobile_phone", "work_direct_phone", "corporate_phone"),
        linkedin: pick(r, "linkedin", "person_linkedin_url", "linkedin_url"),
        emailStatus: /verified|valid/i.test(pick(r, "email_status") ?? "") ? "VALID" : "UNKNOWN",
        source: "CSV",
      },
      update: {
        title: pick(r, "job_title", "title"),
        phone: pick(r, "mobile_number", "phone", "mobile_phone"),
      },
    });
    touched.add(companyId);
    contacts++;
  }

  if (touched.size) {
    const siteIds = (await db.site.findMany({ where: { companyId: { in: [...touched] } }, select: { id: true } })).map(
      (s) => s.id,
    );
    await rescoreSites(siteIds);
  }
  return {
    summary: `CSV: ${contacts} contacts (${matched} matched to MSHA operators, ${newCompanies} new companies), ${skipped} skipped.`,
    contacts,
    matchedCompanies: matched,
    newCompanies,
    skipped,
  };
}

// ---------------------------------------------------------------- Apollo enrichment

/**
 * Find decision makers for the best-scoring operators that have no email contact yet.
 * People search is free; revealing an email costs an Apollo credit and is capped per day.
 */
export async function enrichTopCompanies(limit = 10): Promise<{ summary: string; revealed: number; searched: number }> {
  if (!apolloEnabled()) return { summary: "Apollo not configured (APOLLO_API_KEY).", revealed: 0, searched: 0 };
  const settings = await getSettings();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const revealedToday = await db.contact.count({ where: { source: "APOLLO", createdAt: { gte: startOfDay } } });
  let budget = settings.apolloRevealEmails ? Math.max(0, settings.apolloDailyRevealCap - revealedToday) : 0;

  const candidates = await db.company.findMany({
    where: {
      isLargeNational: false,
      contacts: { none: { email: { not: null } } },
      OR: [{ enrichedAt: null }, { enrichedAt: { lt: new Date(Date.now() - 60 * DAY) } }],
      sites: { some: { score: { gte: Math.max(0, settings.minScoreToEnroll - 15) } } },
    },
    include: { sites: { select: { score: true }, orderBy: { score: "desc" }, take: 1 } },
    take: 200,
  });
  candidates.sort((a, b) => (b.sites[0]?.score ?? 0) - (a.sites[0]?.score ?? 0));

  let searched = 0;
  let revealed = 0;
  for (const c of candidates.slice(0, limit)) {
    searched++;
    const org = await findOrganization(c.name).catch(() => null);
    await db.company.update({
      where: { id: c.id },
      data: {
        enrichedAt: new Date(),
        domain: c.domain ?? org?.primary_domain ?? undefined,
        website: c.website ?? org?.website_url ?? undefined,
        phone: c.phone ?? org?.phone ?? undefined,
      },
    });
    if (!org) continue;
    const people = await searchBuyers(org.id).catch(() => []);
    for (const p of people.slice(0, 2)) {
      if (budget <= 0) break;
      const person = await revealPerson(p.id).catch(() => null);
      budget--;
      const email = person?.email?.toLowerCase();
      if (!email || /email_not_unlocked|domain\.com$/.test(email)) continue;
      await db.contact.upsert({
        where: { email },
        create: {
          companyId: c.id,
          email,
          firstName: person?.first_name ?? p.first_name ?? null,
          lastName: person?.last_name ?? null,
          title: person?.title ?? p.title ?? null,
          linkedin: person?.linkedin_url ?? null,
          emailStatus: person?.email_status === "verified" ? "VALID" : "UNKNOWN",
          source: "APOLLO",
        },
        update: {},
      });
      revealed++;
      if (titleRank(person?.title) <= 2) break; // owner/president found: one is enough
    }
  }
  if (revealed) {
    const ids = candidates.slice(0, limit).map((c) => c.id);
    const siteIds = (await db.site.findMany({ where: { companyId: { in: ids } }, select: { id: true } })).map((s) => s.id);
    await rescoreSites(siteIds);
  }
  return { summary: `Apollo: searched ${searched} operators, revealed ${revealed} emails.`, revealed, searched };
}
