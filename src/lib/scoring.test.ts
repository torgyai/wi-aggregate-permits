import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreSite, type ScoreInput } from "./scoring";

const base: ScoreInput = {
  commodity: "SAND_GRAVEL",
  mshaStatus: "ACTIVE",
  statusDate: null,
  employees: 8,
  portable: false,
  isNewSite: false,
  plannedExpansion: null,
  company: { isLargeNational: false, nationalSiteCount: 2, wiSiteCount: 2 },
  signals: [],
  hasEmailContact: true,
};
const now = new Date("2026-09-24T00:00:00Z");

test("independent active pit with a contact is a solid lead", () => {
  const { score } = scoreSite(base, now);
  assert.ok(score >= 45 && score <= 60, String(score));
});

test("fresh ownership change pushes a lead near the top", () => {
  const { score, reasons } = scoreSite(
    { ...base, signals: [{ type: "OWNERSHIP_CHANGE", detectedAt: new Date("2026-06-01Z") }] },
    now,
  );
  assert.ok(score >= 70, String(score));
  assert.match(reasons[0].reason, /Ownership/);
});

test("stale signals don't count, duplicates count once", () => {
  const old = scoreSite({ ...base, signals: [{ type: "REACTIVATION", detectedAt: new Date("2024-01-01Z") }] }, now);
  assert.equal(old.score, scoreSite(base, now).score);
  const dup = scoreSite(
    {
      ...base,
      signals: [
        { type: "REACTIVATION", detectedAt: new Date("2026-09-01Z") },
        { type: "REACTIVATION", detectedAt: new Date("2026-08-01Z") },
      ],
    },
    now,
  );
  assert.equal(dup.score, scoreSite(base, now).score + 20);
});

test("large nationals are deprioritised", () => {
  const { score } = scoreSite({ ...base, company: { isLargeNational: true, nationalSiteCount: 300, wiSiteCount: 20 } }, now);
  assert.ok(score < 20, String(score));
});

test("abandoned is zero and score is clamped to 0..100", () => {
  assert.equal(scoreSite({ ...base, mshaStatus: "ABANDONED" }, now).score, 0);
  const maxed = scoreSite(
    {
      ...base,
      commodity: "INDUSTRIAL_SAND",
      mshaStatus: "NEW",
      plannedExpansion: true,
      portable: true,
      signals: [
        { type: "OWNERSHIP_CHANGE", detectedAt: new Date("2026-09-01Z") },
        { type: "EXPANSION", detectedAt: new Date("2026-09-01Z") },
      ],
    },
    now,
  );
  assert.equal(maxed.score, 100);
});
