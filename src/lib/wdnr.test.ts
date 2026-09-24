import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, matchSite, toApplication } from "./wdnr";

const sites = [
  { id: "a", companyId: "c1", name: "Smith Pit", latitude: 43.07, longitude: -89.4, companyName: "Smith Sand & Gravel LLC" },
  { id: "b", companyId: "c2", name: "North Quarry", latitude: 44.5, longitude: -88.0, companyName: "Badger Stone Inc" },
];

test("parses point and polygon features with loose field names", () => {
  const pt = toApplication(
    { attributes: { OBJECTID: 7, SITE_NAME: "New Pit", FULL_PERMIT_NO: "WI-0046515-07-999", COUNTY_NAME: "Dane" }, geometry: { x: -89.41, y: 43.071 } },
    32,
  )!;
  assert.equal(pt.key, "wdnr:app:WI-0046515-07-999");
  assert.equal(pt.county, "Dane");
  assert.deepEqual([pt.lat, pt.lon], [43.071, -89.41]);
  const poly = toApplication(
    { attributes: { SITE_NAME: "Poly" }, geometry: { rings: [[[-88, 44], [-88, 45], [-87, 45], [-87, 44]]] } },
    33,
  )!;
  assert.deepEqual([poly.lat, poly.lon], [44.5, -87.5]);
  assert.equal(toApplication({ attributes: {} }, 32), null);
});

test("matches by distance first, then by name", () => {
  const near = toApplication({ attributes: { SITE_NAME: "Whatever" }, geometry: { x: -89.405, y: 43.072 } }, 32)!;
  assert.equal(matchSite(near, sites)?.id, "a");
  const named = toApplication({ attributes: { SITE_NAME: "Expansion", OWNER_NAME: "Badger Stone, Inc." } }, 32)!;
  assert.equal(matchSite(named, sites)?.id, "b");
  const none = toApplication({ attributes: { SITE_NAME: "Elsewhere" }, geometry: { x: -91, y: 46 } }, 32)!;
  assert.equal(matchSite(none, sites), null);
});

test("haversine sanity", () => {
  assert.ok(Math.abs(haversineKm(43, -89, 44, -89) - 111.2) < 0.5);
});
