import { test } from "node:test";
import assert from "node:assert/strict";
import { assessNeeds, estimateTimelineWeeks, inScope, profileFromSite, signalFlags } from "./catalog";
import { nextDue, obligationsFor, OBLIGATIONS } from "./obligations";

const byKey = (items: ReturnType<typeof assessNeeds>) => Object.fromEntries(items.map((i) => [i.key, i]));

test("new sand & gravel pit with wash plant needs the full state + local stack", () => {
  const n = byKey(
    assessNeeds({ commodity: "SAND_GRAVEL", isNewSite: true, washing: true, crushing: true, oilStorageGallons: 2000 }),
  );
  assert.equal(n.NR135_RECLAMATION.status, "REQUIRED");
  assert.equal(n.FINANCIAL_ASSURANCE.status, "REQUIRED");
  assert.equal(n.LOCAL_ZONING.status, "REQUIRED");
  assert.equal(n.WPDES_NMM_GP.status, "REQUIRED");
  assert.equal(n.AIR_PERMIT.status, "REQUIRED");
  assert.equal(n.SPCC.status, "REQUIRED");
  assert.equal(n.MSHA_LEGAL_ID.status, "REQUIRED");
  assert.equal(n.HIGH_CAP_WELL.status, "CHECK");
});

test("existing quiet pit: no MSHA filing, SPCC under threshold is not required", () => {
  const n = byKey(assessNeeds({ commodity: "SAND_GRAVEL", oilStorageGallons: 500, crushing: false }));
  assert.equal(n.MSHA_LEGAL_ID.status, "NO");
  assert.equal(n.SPCC.status, "NO");
  assert.equal(n.AIR_PERMIT.status, "CHECK");
  assert.equal(n.NR135_RECLAMATION.status, "LIKELY");
});

test("ownership change triggers transfers", () => {
  const n = byKey(assessNeeds({ commodity: "CRUSHED_STONE", ownershipChange: true }));
  assert.equal(n.NR135_RECLAMATION.status, "REQUIRED");
  assert.equal(n.WPDES_NMM_GP.status, "REQUIRED");
  assert.equal(n.MSHA_LEGAL_ID.status, "REQUIRED");
  assert.equal(n.AIR_PERMIT.status, "LIKELY");
  assert.equal(n.BLASTING.status, "LIKELY");
});

test("abandoned sites need nothing from the reclamation or WPDES items", () => {
  const n = byKey(assessNeeds({ commodity: "SAND_GRAVEL", mshaStatus: "ABANDONED" }));
  assert.equal(n.NR135_RECLAMATION.status, "NO");
  assert.equal(n.WPDES_NMM_GP.status, "NO");
});

test("results are sorted REQUIRED first and scope excludes NO/OPTIONAL", () => {
  const items = assessNeeds({ commodity: "SAND_GRAVEL", isNewSite: true });
  assert.equal(items[0].status, "REQUIRED");
  assert.ok(inScope(items).every((i) => i.status !== "NO" && i.status !== "OPTIONAL"));
});

test("timeline is driven by the slowest required permit plus intake", () => {
  const [lo, hi] = estimateTimelineWeeks(assessNeeds({ commodity: "SAND_GRAVEL", isNewSite: true, crushing: true }));
  assert.ok(lo >= 10 && hi >= 28, `${lo}-${hi}`);
});

test("annual obligations roll to next year once the date has passed", () => {
  const def = OBLIGATIONS.find((o) => o.key === "NR135_ANNUAL_REPORT")!;
  // NR 135.36: operator annual report due January 31.
  assert.equal(nextDue(def, new Date("2026-01-10T00:00:00Z")).toISOString().slice(0, 10), "2026-01-31");
  assert.equal(nextDue(def, new Date("2026-02-01T00:00:00Z")).toISOString().slice(0, 10), "2027-01-31");
});

test("quarterly and monthly obligations land on period ends", () => {
  const q = OBLIGATIONS.find((o) => o.cadence === "QUARTERLY")!;
  const m = OBLIGATIONS.find((o) => o.cadence === "MONTHLY")!;
  assert.equal(nextDue(q, new Date("2026-05-10T00:00:00Z")).toISOString().slice(0, 10), "2026-06-30");
  assert.equal(nextDue(m, new Date("2026-02-10T00:00:00Z")).toISOString().slice(0, 10), "2026-02-28");
});

test("obligations follow the in-scope permits only", () => {
  const obs = obligationsFor(["NR135_RECLAMATION"]);
  assert.ok(obs.length >= 2);
  assert.ok(obs.every((o) => o.permitKey === "NR135_RECLAMATION"));
});

test("fresh expansion/hearing signals mark the site as expanding unless the record says otherwise", () => {
  const now = new Date("2026-09-24T00:00:00Z");
  const flags = signalFlags([{ type: "HEARING_NOTICE", detectedAt: new Date("2026-08-01Z") }], now);
  assert.equal(flags.plannedExpansion, true);
  assert.equal(signalFlags([{ type: "HEARING_NOTICE", detectedAt: new Date("2024-01-01Z") }], now).plannedExpansion, undefined);
  const site = {
    commodity: "CRUSHED_STONE", county: "Washington", isNewSite: false, plannedExpansion: null, acreage: null, dewatering: null,
    washing: null, crushing: null, highCapWell: null, nearWetlands: null, oilStorageGallons: null, blasting: null,
    hotMixAsphalt: null, portable: false, mshaStatus: "ACTIVE",
  };
  const n = byKey(assessNeeds(profileFromSite(site, flags)));
  assert.equal(n.LOCAL_ZONING.status, "REQUIRED");
  assert.equal(n.FINANCIAL_ASSURANCE.status, "REQUIRED");
  assert.equal(profileFromSite({ ...site, plannedExpansion: false }, flags).plannedExpansion, false);
});
