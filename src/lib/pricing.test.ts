import { test } from "node:test";
import assert from "node:assert/strict";
import { quote } from "./pricing";

const n = (...keys: string[]) => keys.map((key) => ({ key, status: "REQUIRED" as const }));

test("new sand & gravel pit anchors at the standard price", () => {
  const q = quote({ commodity: "SAND_GRAVEL", needs: n("NR135_RECLAMATION", "LOCAL_ZONING", "WPDES_NMM_GP"), isNewOrExpanding: true, wiSiteCount: 1 });
  assert.equal(q.tier, "T2");
  assert.equal(q.price, 40000);
  assert.equal(q.retainerMonthly, 750);
});

test("quarry with blasting + high-cap + air lands in the quarry band, capped at 75k", () => {
  const q = quote({ commodity: "CRUSHED_STONE", needs: n("BLASTING", "HIGH_CAP_WELL", "AIR_PERMIT", "WETLAND_WATERWAY"), isNewOrExpanding: true, wiSiteCount: 2 });
  assert.equal(q.tier, "T3");
  assert.equal(q.price, 75000);
});

test("existing single site transfer is a tune-up", () => {
  const q = quote({ commodity: "SAND_GRAVEL", needs: n("NR135_RECLAMATION", "FINANCIAL_ASSURANCE", "WPDES_NMM_GP", "MSHA_LEGAL_ID"), isNewOrExpanding: false, wiSiteCount: 1 });
  assert.equal(q.tier, "T1");
  assert.ok(q.price >= 15000 && q.price <= 25000, String(q.price));
});

test("multi-site and industrial sand are programs", () => {
  assert.equal(quote({ commodity: "SAND_GRAVEL", needs: [], isNewOrExpanding: false, wiSiteCount: 6 }).price, 110000);
  const frac = quote({ commodity: "INDUSTRIAL_SAND", needs: [], isNewOrExpanding: false, wiSiteCount: 1 });
  assert.equal(frac.tier, "T4");
  assert.equal(frac.price, 105000);
  assert.equal(frac.retainerMonthly, 2000);
});

test("price follows the configured standard", () => {
  assert.equal(quote({ commodity: "SAND_GRAVEL", needs: [], isNewOrExpanding: true, wiSiteCount: 1, standardPrice: 45000 }).price, 45000);
});
