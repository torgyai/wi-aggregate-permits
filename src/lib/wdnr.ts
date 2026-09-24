/**
 * WDNR storm water permit map service: nonmetallic mining sites that have an
 * *application received* for WPDES general permit coverage. An operator filing
 * for coverage is actively permitting — a new pit, an expansion or a new owner —
 * so each application becomes a PERMIT_APPLICATION signal on the nearest site.
 *
 * Service (public ArcGIS REST, 1,000 records per page):
 * https://dnrmaps.wi.gov/arcgis2/rest/services/WT_SW_PERMIT/WT_SW_SWAMP_Permit_Industrial/MapServer
 * Layers 32–34 = "Application Received" (nonmetallic mining ops group, layer 26).
 */
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { normalizeCompanyName } from "./msha";

export const WDNR_SERVICE =
  process.env.WDNR_NMM_SERVICE ||
  "https://dnrmaps.wi.gov/arcgis2/rest/services/WT_SW_PERMIT/WT_SW_SWAMP_Permit_Industrial/MapServer";
export const WDNR_APPLICATION_LAYERS = (process.env.WDNR_APPLICATION_LAYERS || "32,33,34")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter(Number.isFinite);

type Feature = {
  attributes: Record<string, unknown>;
  geometry?: { x?: number; y?: number; rings?: number[][][] };
};

export type WdnrApplication = {
  key: string;
  siteName: string;
  permitNo: string | null;
  owner: string | null;
  county: string | null;
  lat: number | null;
  lon: number | null;
  attributes: Record<string, unknown>;
};

const field = (attrs: Record<string, unknown>, ...patterns: RegExp[]) => {
  for (const re of patterns) {
    const k = Object.keys(attrs).find((key) => re.test(key));
    const v = k ? attrs[k] : null;
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
};

function centroid(g: Feature["geometry"]): [number | null, number | null] {
  if (!g) return [null, null];
  if (typeof g.x === "number" && typeof g.y === "number") return [g.y, g.x];
  const ring = g.rings?.[0];
  if (!ring?.length) return [null, null];
  const [sx, sy] = ring.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return [sy / ring.length, sx / ring.length];
}

export function toApplication(f: Feature, layer: number): WdnrApplication | null {
  const a = f.attributes ?? {};
  const siteName = field(a, /^SITE_NAME$/i, /SITE.*NAME/i, /FAC.*NAME/i, /^NAME$/i);
  if (!siteName) return null;
  const permitNo = field(a, /^FULL_PERMIT_NO$/i, /^PERMIT_NO$/i, /PERMIT/i);
  const [lat, lon] = centroid(f.geometry);
  const id = field(a, /^OBJECTID$/i, /^FID$/i) ?? `${siteName}-${lat}-${lon}`;
  return {
    key: `wdnr:app:${permitNo ?? `${layer}:${id}`}`,
    siteName,
    permitNo,
    owner: field(a, /OWNER/i, /PERMITTEE/i, /OPERATOR/i, /COMPANY/i, /CUST.*NAME/i),
    county: field(a, /COUNTY/i),
    lat,
    lon,
    attributes: a,
  };
}

async function fetchLayer(layer: number): Promise<WdnrApplication[]> {
  const out: WdnrApplication[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const url =
      `${WDNR_SERVICE}/${layer}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json` +
      `&resultOffset=${offset}&resultRecordCount=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WDNR layer ${layer}: HTTP ${res.status}`);
    const body = (await res.json()) as { features?: Feature[]; exceededTransferLimit?: boolean; error?: { message: string } };
    if (body.error) throw new Error(`WDNR layer ${layer}: ${body.error.message}`);
    for (const f of body.features ?? []) {
      const app = toApplication(f, layer);
      if (app) out.push(app);
    }
    if (!body.exceededTransferLimit || !body.features?.length) break;
  }
  return out;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

type SiteLite = { id: string; companyId: string | null; name: string; latitude: number | null; longitude: number | null; companyName: string | null };

/** Nearest site within 2 km, else a name match on site or operator. */
export function matchSite(app: WdnrApplication, sites: SiteLite[]): SiteLite | null {
  if (app.lat != null && app.lon != null) {
    let best: SiteLite | null = null;
    let bestKm = 2;
    for (const s of sites) {
      if (s.latitude == null || s.longitude == null) continue;
      const km = haversineKm(app.lat, app.lon, s.latitude, s.longitude);
      if (km < bestKm) {
        best = s;
        bestKm = km;
      }
    }
    if (best) return best;
  }
  const names = [app.siteName, app.owner].filter(Boolean).map((n) => normalizeCompanyName(n!));
  return (
    sites.find((s) => {
      const sn = normalizeCompanyName(s.name);
      const cn = s.companyName ? normalizeCompanyName(s.companyName) : "";
      return names.some((n) => n.length > 4 && (n === sn || (cn && (n.includes(cn) || cn.includes(n)))));
    }) ?? null
  );
}

export async function syncWdnrApplications(): Promise<{ summary: string; applications: number; signals: number }> {
  const apps = (await Promise.all(WDNR_APPLICATION_LAYERS.map((l) => fetchLayer(l).catch(() => [])))).flat();
  const sites: SiteLite[] = (
    await db.site.findMany({
      select: { id: true, companyId: true, name: true, latitude: true, longitude: true, company: { select: { name: true } } },
    })
  ).map((s) => ({ ...s, companyName: s.company?.name ?? null }));

  const data: Prisma.SignalCreateManyInput[] = apps.map((app) => {
    const site = matchSite(app, sites);
    return {
      externalKey: app.key,
      siteId: site?.id,
      companyId: site?.companyId ?? undefined,
      type: "PERMIT_APPLICATION",
      title: `WPDES nonmetallic mining application: ${app.siteName}`,
      detail: [app.owner && `Applicant: ${app.owner}`, app.county && `${app.county} County`, app.permitNo && `Permit ${app.permitNo}`]
        .filter(Boolean)
        .join(" · "),
      weight: 20,
    };
  });
  const created = data.length ? (await db.signal.createMany({ data, skipDuplicates: true })).count : 0;
  return {
    summary: `WDNR: ${apps.length} pending WPDES nonmetallic applications, ${created} new signals.`,
    applications: apps.length,
    signals: created,
  };
}
