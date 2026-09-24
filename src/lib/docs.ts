/**
 * Permit document drafts. One working document per in-scope permit, built from
 * the client's intake. Claude writes the narrative sections; a deterministic
 * template is the fallback and the skeleton. Anything the intake doesn't
 * answer is marked [CONFIRM: ...] — never invented.
 */
import { z } from "zod";
import { AiUnavailable, generateJson } from "./ai";
import { COMMODITY_LABEL } from "./enums";
import { usd } from "./format";
import { LAND_USE_LABEL, type Intake } from "./intake";
import { PERMIT_BY_KEY, type PermitDef } from "./permits/catalog";

type DocInput = {
  permitKey: string;
  intake: Intake;
  site: { commodity: string; mshaMineId: string | null; latitude: number | null; longitude: number | null };
  client: { name: string };
  firm: { name: string; contact: string };
};

const C = (what: string) => `[CONFIRM: ${what}]`;
const v = (x: string | number | undefined | null, what: string) =>
  x === undefined || x === null || x === "" ? C(what) : String(x);
const yn = (x: "yes" | "no" | "unknown", what: string) => (x === "unknown" ? C(what) : x === "yes" ? "Yes" : "No");

// Planning-level unit costs for the reclamation estimate. Calibrate to the
// county's accepted contractor rates before filing.
export const RECLAMATION_UNIT_COSTS = {
  mobilization: 5000,
  gradingPerAcre: 3500,
  topsoilPerAcre: 4000,
  seedingPerAcre: 1200,
  erosionControlPerAcre: 800,
  contingencyPct: 10,
  administrationPct: 10,
};

export function reclamationEstimate(disturbedAcres: number, u = RECLAMATION_UNIT_COSTS) {
  const lines = [
    { item: "Mobilization / demobilization", qty: 1, unit: "LS", rate: u.mobilization },
    { item: "Final grading and slope reduction", qty: disturbedAcres, unit: "acre", rate: u.gradingPerAcre },
    { item: "Topsoil replacement", qty: disturbedAcres, unit: "acre", rate: u.topsoilPerAcre },
    { item: "Seed, fertilizer, mulch", qty: disturbedAcres, unit: "acre", rate: u.seedingPerAcre },
    { item: "Temporary erosion control", qty: disturbedAcres, unit: "acre", rate: u.erosionControlPerAcre },
  ].map((l) => ({ ...l, total: Math.round(l.qty * l.rate) }));
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const contingency = Math.round((subtotal * u.contingencyPct) / 100);
  const admin = Math.round(((subtotal + contingency) * u.administrationPct) / 100);
  return { lines, subtotal, contingency, admin, total: subtotal + contingency + admin };
}

function header(def: PermitDef, d: DocInput) {
  const i = d.intake;
  return [
    `# ${def.name} — working draft`,
    ``,
    `**Client:** ${d.client.name}  `,
    `**Site:** ${i.siteName}, ${i.town ? `Town of ${i.town}, ` : ""}${i.county} County, Wisconsin  `,
    `**Agency:** ${def.agency}  `,
    `**Authority:** ${def.citation}  `,
    `**Prepared by:** ${d.firm.name} (${d.firm.contact})`,
    ``,
    `> Draft for client review. Highlighted CONFIRM items need an answer or a document before filing.${def.verify ? ` Permitting lead: ${def.verify}` : ""}`,
    ``,
  ].join("\n");
}

function siteFacts(d: DocInput) {
  const i = d.intake;
  const rows: [string, string][] = [
    ["Project type", { new: "New site", expansion: "Expansion of existing site", existing: "Existing site", transfer: "Transfer to new operator" }[i.projectType]],
    ["Commodity", COMMODITY_LABEL[d.site.commodity] ?? d.site.commodity],
    ["MSHA mine ID", v(d.site.mshaMineId, "MSHA ID, or 'new'")],
    ["Parcel IDs", v(i.parcelIds, "tax parcel numbers")],
    ["Legal description", v(i.legalDescription, "¼¼, section, township, range")],
    ["Coordinates", d.site.latitude != null ? `${d.site.latitude.toFixed(5)}, ${d.site.longitude?.toFixed(5)}` : C("site centroid")],
    ["Landowner", v(i.landownerName, "landowner of record")],
    ["Total site acres", v(i.totalAcres, "total acres")],
    ["Disturbed / to be disturbed", v(i.disturbedAcres, "acres disturbed")],
    ["Maximum depth", i.maxDepthFt != null ? `${i.maxDepthFt} ft` : C("max depth")],
    ["Depth to groundwater", i.depthToGroundwaterFt != null ? `${i.depthToGroundwaterFt} ft` : C("groundwater elevation")],
    ["Mining below water table", yn(i.belowWaterTable, "below water table?")],
    ["Post-mining land use", LAND_USE_LABEL[i.postMiningLandUse]],
  ];
  return ["## Site summary", "", "| | |", "|---|---|", ...rows.map(([k, val]) => `| ${k} | ${val} |`), ""].join("\n");
}

function checklist(def: PermitDef) {
  return ["## Deliverables", "", ...def.deliverables.map((x) => `- [ ] ${x}`), ""].join("\n");
}

/** Deterministic template for each permit. */
export function templateDoc(d: DocInput): string {
  const def = PERMIT_BY_KEY[d.permitKey];
  if (!def) return `# ${d.permitKey}\n\nUnknown permit.`;
  const i = d.intake;
  const parts = [header(def, d), siteFacts(d)];

  switch (def.key) {
    case "NR135_RECLAMATION":
      parts.push(
        [
          "## Reclamation plan outline (NR 135.19)",
          "",
          "### 1. Site information",
          `- Location map, property boundaries and permit boundary ${C("survey or GIS boundary")}`,
          `- Geology and deposit: ${COMMODITY_LABEL[d.site.commodity] ?? "aggregate"} to ~${v(i.maxDepthFt, "depth")} ft`,
          `- Topsoil: ~${v(i.topsoilInches, "topsoil depth")} in; salvaged and stockpiled on site, seeded against erosion`,
          `- Surface water and drainage: ${v(i.nearestWaterbody, "nearest waterbody / drainage direction")}`,
          `- Groundwater: ${i.depthToGroundwaterFt != null ? `approx. ${i.depthToGroundwaterFt} ft below grade` : C("approximate groundwater elevation")}`,
          "",
          "### 2. Post-mining land use",
          `${LAND_USE_LABEL[i.postMiningLandUse]}. ${i.postMiningLandUse === "undecided" ? C("landowner's preferred end use") : ""}`,
          "",
          "### 3. Reclamation measures",
          "- Final slopes graded no steeper than the ordinance standard (typically 3:1 above water) " + C("county slope standard"),
          "- Topsoil respread to original depth; seeded with a native or agricultural mix suited to the end use",
          "- Progressive reclamation by phase as mining completes each area",
          `- Phase sequence: ${C("phase map and years per phase")}`,
          "",
          "### 4. Criteria for successful reclamation",
          "- Vegetative cover density per the county standard, stable slopes without rills or gullies",
          "- Site consistent with the approved post-mining land use",
          "",
          "## Permit application items (NR 135.18)",
          `- [ ] Legal description and parcel IDs — ${v(i.parcelIds, "parcels")}`,
          `- [ ] Owner, lessor and operator names/addresses — ${v(i.landownerName, "landowner")} / ${d.client.name}`,
          "- [ ] Reclamation plan (above) with maps",
          "- [ ] Certification of intent to comply with reclamation standards",
          "- [ ] Certification that financial assurance will be posted before mining",
          "- [ ] WDNR share of fee (new sites)",
          "",
        ].join("\n"),
      );
      break;
    case "FINANCIAL_ASSURANCE": {
      const acres = i.disturbedAcres ?? i.totalAcres;
      if (acres) {
        const est = reclamationEstimate(acres);
        parts.push(
          [
            `## Planning-level reclamation cost estimate (${acres} acres)`,
            "",
            "| Item | Qty | Unit | Rate | Total |",
            "|---|---:|---|---:|---:|",
            ...est.lines.map((l) => `| ${l.item} | ${l.qty} | ${l.unit} | ${usd(l.rate)} | ${usd(l.total)} |`),
            `| Subtotal | | | | ${usd(est.subtotal)} |`,
            `| Contingency (${RECLAMATION_UNIT_COSTS.contingencyPct}%) | | | | ${usd(est.contingency)} |`,
            `| Administration (${RECLAMATION_UNIT_COSTS.administrationPct}%) | | | | ${usd(est.admin)} |`,
            `| **Financial assurance amount** | | | | **${usd(est.total)}** |`,
            "",
            `> Unit rates are planning-level. ${C("calibrate to county-accepted contractor rates")}. Phasing the bond to the active phase only usually lowers the amount posted.`,
            "",
          ].join("\n"),
        );
      } else parts.push(`## Reclamation cost estimate\n\n${C("disturbed acres needed to compute the estimate")}\n`);
      parts.push(
        "## Instrument\n\nBond, irrevocable letter of credit, cash/CD, escrow or other NR 135.40 form. Cancellation requires 90 days' notice to the regulatory authority. " +
          C("preferred instrument and surety") +
          "\n",
      );
      break;
    }
    case "WPDES_NMM_GP":
      parts.push(
        [
          "## Notice of Intent data",
          `- Discharges: storm water${i.dewatering === "yes" ? ", pit dewatering" : ""}${i.washing === "yes" ? ", wash water" : ""}${
            i.dewatering === "unknown" || i.washing === "unknown" ? ` ${C("dewatering / washing")}` : ""
          }`,
          `- Receiving water: ${v(i.nearestWaterbody, "receiving water / infiltration")}`,
          "",
          "## Storm Water Pollution Prevention Plan (SWPPP) outline",
          "1. Site map: drainage areas, outfalls, stockpiles, fueling, haul roads",
          "2. Potential pollutant sources: sediment, fuel/oil, process water",
          `3. BMPs: berms, sediment basins, stabilized entrance, spill kits, fuel containment (${v(i.fuelStorageGallons, "fuel storage gallons")} gal on site)`,
          "4. Inspections: quarterly visual; annual facility site compliance inspection",
          "5. Sampling and eDMR schedule per coverage letter",
          "6. Spill response and employee training",
          "",
        ].join("\n"),
      );
      break;
    case "AIR_PERMIT":
      parts.push(
        [
          "## Applicability",
          `- Crushing/screening on site: ${yn(i.crushing, "crusher on site?")}; portable plant: ${yn(i.portablePlant, "portable?")}`,
          `- Equipment: ${v(i.equipmentList, "crusher/screen/conveyor list with make, model, year, rated tph")}`,
          `- Max throughput: ${i.maxThroughputTph != null ? `${i.maxThroughputTph} tph` : C("rated tph")}`,
          `- NSPS Subpart OOO: applies to equipment built after Aug 31, 1983 at fixed plants over 25 tph or portable plants over 150 tph — ${
            i.maxThroughputTph != null
              ? i.maxThroughputTph > (i.portablePlant === "yes" ? 150 : 25)
                ? "likely applies"
                : "likely below threshold"
              : C("rated capacity")
          }`,
          `- Hot mix / ready mix on site: ${yn(i.hotMixOrReadyMix, "HMA or RMX plant?")}`,
          "",
          "## Permit path",
          "- Crushing Plants General Construction and Operation Permit (Form 4530-141) if eligible, else registration or site-specific permit",
          i.portablePlant === "yes" ? "- Portable relocation notice (Form 4500-025) at least 20 days before each move" : "",
          "- Fugitive dust control plan (NR 415); haul road watering, speed limit, stockpile management",
          "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      break;
    case "LOCAL_ZONING":
      parts.push(
        [
          "## Operations plan (conditional use application)",
          `- Hours of operation: ${v(i.hoursOfOperation, "hours and days")}`,
          `- Season: ${v(i.seasonMonths, "operating months")}`,
          `- Truck traffic: ${i.truckTripsPerDay != null ? `~${i.truckTripsPerDay} trips/day` : C("trips per day")}`,
          `- Haul route: ${v(i.haulRoute, "haul route to state/county highway")}`,
          `- Nearest residence: ${i.nearestResidenceFt != null ? `${i.nearestResidenceFt} ft` : C("distance to nearest residence")}`,
          `- Blasting: ${yn(i.blasting, "blasting?")}`,
          "- Screening: perimeter berms seeded, setbacks per ordinance " + C("county setback distances"),
          "- Dust: water truck on haul roads, speed limit, stockpile management",
          "- Noise: equipment with ambient-sensing backup alarms where allowed; hours limits",
          "",
          "## Anticipated neighbor questions",
          `- Groundwater and wells: ${i.belowWaterTable === "yes" ? "mining below the water table — prepare well-protection commitments" : "mining above the water table"}`,
          "- Truck traffic and road maintenance",
          "- Property values and end use (see reclamation plan)",
          i.countyConcerns ? `- County has already raised: ${i.countyConcerns}` : "",
          "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      break;
    case "HIGH_CAP_WELL":
      parts.push(
        [
          "## Capacity determination",
          `- Dewatering pumps: ${i.dewateringGpm != null ? `${i.dewateringGpm} gpm` : C("pump capacity gpm")}`,
          `- Other wells on property: ${v(i.wellsOnProperty, "wells and capacities (exclude residential / fire protection)")}`,
          "- Threshold: combined capacity over 100,000 gpd (~70 gpm) on the property requires approval before construction",
          "",
        ].join("\n"),
      );
      break;
    case "SPCC":
      parts.push(
        [
          "## Applicability",
          `- Aboveground oil storage (containers ≥ 55 gal): ${i.fuelStorageGallons != null ? `${i.fuelStorageGallons} gal` : C("tank inventory")}`,
          `- Threshold 1,320 gal: ${i.fuelStorageGallons != null ? (i.fuelStorageGallons > 1320 ? "exceeded — plan required" : "not exceeded") : C("inventory")}`,
          `- Qualified facility (≤ 10,000 gal): ${i.fuelStorageGallons != null ? (i.fuelStorageGallons <= 10000 ? "yes — self-certification may be available" : "no — PE certification") : C("inventory")}`,
          "",
        ].join("\n"),
      );
      break;
    default:
      parts.push(`## Reason in scope\n\n${def.summary}\n`);
  }
  parts.push(checklist(def));
  if (i.notes) parts.push(`## Client notes\n\n${i.notes}\n`);
  return parts.join("\n");
}

const DocSchema = z.object({ markdown: z.string().min(200) });
const DOC_JSON = {
  type: "object",
  properties: { markdown: { type: "string", description: "The complete working draft in GitHub-flavored Markdown." } },
  required: ["markdown"],
  additionalProperties: false,
};

const SYSTEM = `You are a senior Wisconsin environmental permitting specialist drafting working documents for a sand & gravel / quarry client. You are given a structured template draft and the client's intake answers.

Improve the draft into a filing-ready working document:
- Keep every table and fact from the template. Expand narrative sections into clear, professional prose an agency reviewer expects.
- Use ONLY facts from the intake and template. Anything unknown stays as [CONFIRM: ...] — never invent numbers, parcel IDs, distances, species, or permit numbers.
- Cite the regulation named in the template where relevant. Do not cite sections you are not given.
- Keep the deliverables checklist at the end.
- Markdown only. No preamble.`;

export async function generateDoc(d: DocInput): Promise<{ title: string; markdown: string; by: "ai" | "template" }> {
  const def = PERMIT_BY_KEY[d.permitKey];
  const template = templateDoc(d);
  const title = `${def?.shortName ?? d.permitKey} — working draft`;
  try {
    const out = await generateJson({
      system: SYSTEM,
      prompt: JSON.stringify({ permit: def && { name: def.name, agency: def.agency, citation: def.citation, summary: def.summary }, intake: d.intake, template }),
      schema: DocSchema,
      jsonSchema: DOC_JSON,
      effort: "high",
      maxTokens: 16000,
    });
    return { title, markdown: out.markdown, by: "ai" };
  } catch (err) {
    if (!(err instanceof AiUnavailable)) console.error("AI doc failed, using template:", err);
    return { title, markdown: template, by: "template" };
  }
}
