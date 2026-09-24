/**
 * MSHA Mine Data Retrieval System open dataset -> Wisconsin aggregate sites.
 *
 * The Mines file is a pipe-delimited text file (inside Mines.zip) with one row
 * per mine ID nationwide: name, operator, controller, status, county, lat/long,
 * SIC commodity, employees. It is the most complete public list of every
 * operating pit and quarry — and diffing it week to week surfaces buying
 * triggers (new mines, ownership changes, reactivations).
 *
 * Parsing is header-driven so column reordering in MSHA's export doesn't break it.
 */
import { canonicalCounty, WI_COUNTIES } from "./wi-counties";

export const DEFAULT_MSHA_MINES_URL = "https://arlweb.msha.gov/OpenGovernmentData/DataSets/Mines.zip";

export type MshaSite = {
  mshaMineId: string;
  name: string;
  operatorName: string;
  operatorId: string | null;
  controllerName: string | null;
  controllerId: string | null;
  controllerSince: Date | null;
  county: string | null;
  countyFips: string | null;
  nearestTown: string | null;
  latitude: number | null;
  longitude: number | null;
  commodity: string;
  sicDescription: string | null;
  mineType: string;
  mshaStatus: string;
  statusDate: Date | null;
  employees: number | null;
  portable: boolean;
};

export type MshaParseResult = {
  sites: MshaSite[];
  /** Active aggregate sites per controller ID, nationwide (large nationals have in-house permitting staff). */
  controllerSiteCounts: Map<string, number>;
  totalRows: number;
};

const LARGE_NATIONAL_PATTERNS = [
  /vulcan/i,
  /martin marietta/i,
  /\bcrh\b/i,
  /holcim/i,
  /heidelberg/i,
  /lehigh/i,
  /knife river/i,
  /summit materials/i,
  /granite construction/i,
  /u\.?s\.? silica/i,
  /covia/i,
  /unimin/i,
  /cemex/i,
  /oldcastle/i,
];

export function isLargeNationalName(name: string | null | undefined) {
  return !!name && LARGE_NATIONAL_PATTERNS.some((re) => re.test(name));
}

/**
 * PRIMARY_CANVASS_CD: 5 = M/NM Sand and Gravel, 6 = M/NM Stone, 7 = NonMetal, 8 = Metal, 1/2 = Coal.
 * The code is authoritative for the broad class; the SIC text splits out industrial sand
 * (canvass 7) and dimension stone.
 */
export function commodityFrom(sic: string | null | undefined, canvassText?: string | null, canvassCode?: string | null): string {
  const bySic = classifyCommodity(sic, canvassText);
  const code = (canvassCode ?? "").trim().replace(/^0+/, "");
  if (!code) return bySic;
  if (code === "5") return bySic === "INDUSTRIAL_SAND" ? bySic : "SAND_GRAVEL";
  if (code === "6") return bySic === "DIMENSION_STONE" ? bySic : "CRUSHED_STONE";
  if (code === "7") return bySic === "INDUSTRIAL_SAND" ? bySic : "OTHER";
  return "OTHER";
}

export function classifyCommodity(sic: string | null | undefined, canvass?: string | null): string {
  const s = `${sic ?? ""} ${canvass ?? ""}`.toLowerCase();
  if (!s.trim()) return "OTHER";
  if (/industrial|silica|frac|glass sand|foundry sand/.test(s) && /sand/.test(s)) return "INDUSTRIAL_SAND";
  if (/dimension/.test(s)) return "DIMENSION_STONE";
  if (/sand|gravel/.test(s)) return "SAND_GRAVEL";
  if (/crushed|broken|limestone|dolomite|granite|traprock|trap rock|quartzite|basalt|sandstone|stone/.test(s))
    return "CRUSHED_STONE";
  return "OTHER";
}

export function normalizeStatus(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (s.startsWith("active")) return "ACTIVE";
  if (s.startsWith("intermittent")) return "INTERMITTENT";
  if (s.startsWith("newmine") || s === "new") return "NEW";
  if (s.startsWith("temporarilyidle") || s.startsWith("tempidle")) return "TEMP_IDLED";
  if (s.startsWith("nonproducing")) return "NONPRODUCING";
  if (s.startsWith("abandoned")) return "ABANDONED";
  return "ACTIVE";
}

export function normalizeMineType(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s.startsWith("under")) return "UNDERGROUND";
  if (s.startsWith("facil")) return "FACILITY";
  return "SURFACE";
}

export function parseMshaDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const t = raw.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

function num(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

/** MSHA stores coordinates as decimal degrees; some rows carry positive longitudes for the western hemisphere. */
function coord(lat: number | null, lon: number | null): [number | null, number | null] {
  if (lat == null || lon == null || lat === 0 || lon === 0) return [null, null];
  const lo = lon > 0 ? -lon : lon;
  // Wisconsin bounding box sanity check.
  if (lat < 42.3 || lat > 47.4 || lo < -93.0 || lo > -86.2) return [null, null];
  return [lat, lo];
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'"()]/g, " ")
    .replace(/\b(inc|incorporated|llc|l l c|co|company|corp|corporation|ltd|lp|llp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse the Mines text export. Keeps Wisconsin metal/nonmetal aggregate sites and
 * counts active aggregate sites per controller nationally.
 */
export function parseMinesText(text: string, state = "WI"): MshaParseResult {
  const lines = text.split(/\r?\n/);
  const header = (lines[0] ?? "").split("|").map((h) => h.trim().replace(/^"|"$/g, "").toUpperCase());
  const idx = (name: string) => header.indexOf(name);
  const col = {
    id: idx("MINE_ID"),
    name: idx("CURRENT_MINE_NAME"),
    coalMetal: idx("COAL_METAL_IND"),
    type: idx("CURRENT_MINE_TYPE"),
    status: idx("CURRENT_MINE_STATUS"),
    statusDate: idx("CURRENT_STATUS_DT"),
    controllerId: idx("CURRENT_CONTROLLER_ID"),
    controllerName: idx("CURRENT_CONTROLLER_NAME"),
    controllerBegin: idx("CURRENT_CONTROLLER_BEGIN_DT"),
    operatorId: idx("CURRENT_OPERATOR_ID"),
    operatorName: idx("CURRENT_OPERATOR_NAME"),
    state: idx("STATE"),
    fipsCounty: idx("FIPS_CNTY_CD"),
    countyName: idx("FIPS_CNTY_NM"),
    sic: idx("PRIMARY_SIC"),
    canvass: idx("PRIMARY_CANVASS"),
    canvassCd: idx("PRIMARY_CANVASS_CD"),
    portable: idx("PORTABLE_OPERATION"),
    employees: idx("NO_EMPLOYEES"),
    lat: idx("LATITUDE"),
    lon: idx("LONGITUDE"),
    town: idx("NEAREST_TOWN"),
  };
  if (col.id < 0 || col.state < 0 || col.name < 0) {
    throw new Error(`Unrecognised MSHA Mines header: ${header.slice(0, 8).join("|")}`);
  }

  const get = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim().replace(/^"|"$/g, "") : "");
  const sites: MshaSite[] = [];
  const controllerSiteCounts = new Map<string, number>();
  let totalRows = 0;

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    totalRows++;
    const cells = line.split("|");
    if (col.coalMetal >= 0 && get(cells, col.coalMetal).toUpperCase() === "C") continue;
    const commodity = commodityFrom(get(cells, col.sic), get(cells, col.canvass), get(cells, col.canvassCd));
    if (commodity === "OTHER") continue;
    const status = normalizeStatus(get(cells, col.status));

    const controllerId = get(cells, col.controllerId) || null;
    if (controllerId && status !== "ABANDONED") {
      controllerSiteCounts.set(controllerId, (controllerSiteCounts.get(controllerId) ?? 0) + 1);
    }

    if (get(cells, col.state).toUpperCase() !== state) continue;

    const fipsRaw = get(cells, col.fipsCounty).replace(/\D/g, "");
    const countyFips = fipsRaw ? fipsRaw.slice(-3).padStart(3, "0") : null;
    const county =
      (countyFips && WI_COUNTIES[countyFips]) || canonicalCounty(get(cells, col.countyName)) || null;
    const [latitude, longitude] = coord(num(get(cells, col.lat)), num(get(cells, col.lon)));

    sites.push({
      mshaMineId: get(cells, col.id).replace(/^0+(?=\d{7})/, ""),
      name: get(cells, col.name) || "Unnamed site",
      operatorName: get(cells, col.operatorName) || get(cells, col.controllerName) || "Unknown operator",
      operatorId: get(cells, col.operatorId) || null,
      controllerName: get(cells, col.controllerName) || null,
      controllerId,
      controllerSince: parseMshaDate(get(cells, col.controllerBegin)),
      county,
      countyFips,
      nearestTown: get(cells, col.town) || null,
      latitude,
      longitude,
      commodity,
      sicDescription: get(cells, col.sic) || null,
      mineType: normalizeMineType(get(cells, col.type)),
      mshaStatus: status,
      statusDate: parseMshaDate(get(cells, col.statusDate)),
      employees: num(get(cells, col.employees)),
      portable: /^y/i.test(get(cells, col.portable)),
    });
  }
  return { sites, controllerSiteCounts, totalRows };
}

/** Unzip Mines.zip (or accept the raw .txt) and decode as Latin-1, which is what MSHA exports. */
export async function readMinesArchive(bytes: Uint8Array): Promise<string> {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) return new TextDecoder("latin1").decode(bytes);
  const { unzipSync } = await import("fflate");
  const files = unzipSync(bytes, { filter: (f) => /\.txt$/i.test(f.name) });
  const name = Object.keys(files).find((n) => /mines/i.test(n)) ?? Object.keys(files)[0];
  if (!name) throw new Error("Mines.zip contained no .txt file");
  return new TextDecoder("latin1").decode(files[name]);
}
