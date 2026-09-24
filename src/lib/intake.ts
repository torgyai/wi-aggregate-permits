import { z } from "zod";

/**
 * Client intake questionnaire — everything the permit drafts need, asked once.
 * Rendered by /intake/[token]; the same schema validates the submission and
 * feeds the document generator.
 */

const yn = z.enum(["yes", "no", "unknown"]).default("unknown");
const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional());
const optStr = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().max(4000).optional());

export const IntakeSchema = z.object({
  // Site & ownership
  siteName: z.string().min(1).max(200),
  siteAddress: optStr,
  town: optStr,
  county: z.string().min(1),
  parcelIds: optStr,
  legalDescription: optStr,
  landownerName: optStr,
  landownerAddress: optStr,
  leaseExpires: optStr,

  // Project type
  projectType: z.enum(["new", "expansion", "existing", "transfer"]),
  targetStart: optStr,

  // Footprint
  totalAcres: optNum,
  disturbedAcres: optNum,
  maxDepthFt: optNum,
  depthToGroundwaterFt: optNum,
  belowWaterTable: yn,
  topsoilInches: optNum,
  postMiningLandUse: z.enum(["agriculture", "residential", "pond_wildlife", "forest", "commercial", "other", "undecided"]).default("undecided"),

  // Water
  dewatering: yn,
  dewateringGpm: optNum,
  washing: yn,
  wellsOnProperty: optStr,
  wetlandsOrStreams: yn,
  nearestWaterbody: optStr,

  // Equipment & processing
  crushing: yn,
  portablePlant: yn,
  equipmentList: optStr,
  maxThroughputTph: optNum,
  hotMixOrReadyMix: yn,
  blasting: yn,
  fuelStorageGallons: optNum,

  // Operations & neighbors
  hoursOfOperation: optStr,
  seasonMonths: optStr,
  truckTripsPerDay: optNum,
  haulRoute: optStr,
  nearestResidenceFt: optNum,

  // History
  existingPermits: optStr,
  countyConcerns: optStr,
  notes: optStr,

  siteContactName: optStr,
  siteContactPhone: optStr,
});

export type Intake = z.infer<typeof IntakeSchema>;

export const LAND_USE_LABEL: Record<string, string> = {
  agriculture: "Agriculture / cropland",
  residential: "Residential development",
  pond_wildlife: "Pond / wildlife habitat",
  forest: "Forest / woodland",
  commercial: "Commercial / industrial",
  other: "Other",
  undecided: "Undecided",
};

const bool = (v: "yes" | "no" | "unknown") => (v === "yes" ? true : v === "no" ? false : null);

/** Sum of every "<n> gpm" mentioned, e.g. "house well 10 gpm, wash well 450 gpm" -> 460. */
export function totalGpm(text: string | undefined): number {
  return Array.from((text ?? "").matchAll(/(\d[\d,]*(?:\.\d+)?)\s*gpm/gi)).reduce(
    (sum, m) => sum + Number(m[1].replace(/,/g, "")),
    0,
  );
}

/** Site attributes the permit engine uses, derived from intake answers. */
export function siteUpdateFromIntake(i: Intake) {
  // s. 281.34: over 100,000 gpd (~70 gpm) combined capacity on the property.
  const wellsHighCap = (i.dewateringGpm ?? 0) + totalGpm(i.wellsOnProperty) >= 70 ? true : null;
  return {
    name: i.siteName,
    county: i.county,
    municipality: i.town ?? undefined,
    acreage: i.disturbedAcres ?? i.totalAcres ?? undefined,
    isNewSite: i.projectType === "new",
    plannedExpansion: i.projectType === "expansion",
    dewatering: bool(i.dewatering),
    washing: bool(i.washing),
    crushing: bool(i.crushing),
    highCapWell: wellsHighCap,
    nearWetlands: bool(i.wetlandsOrStreams),
    oilStorageGallons: i.fuelStorageGallons ?? undefined,
    blasting: bool(i.blasting),
    hotMixAsphalt: bool(i.hotMixOrReadyMix),
    portable: i.portablePlant === "yes" ? true : undefined,
  };
}
