import { test } from "node:test";
import assert from "node:assert/strict";
import { chicagoTime, inWindow, localParts, nextSendTime } from "./window";

const w = { sendWindowStartHour: 8, sendWindowEndHour: 16, sendDays: [1, 2, 3, 4, 5] };
const zero = () => 0;

test("chicagoTime handles CDT and CST", () => {
  assert.equal(chicagoTime(2026, 7, 15, 9).toISOString(), "2026-07-15T14:00:00.000Z"); // CDT = UTC-5
  assert.equal(chicagoTime(2026, 1, 15, 9).toISOString(), "2026-01-15T15:00:00.000Z"); // CST = UTC-6
});

test("inside the window sends now (plus jitter capped to the window)", () => {
  const wed10 = chicagoTime(2026, 9, 23, 10); // Wednesday
  assert.ok(inWindow(wed10, w));
  assert.equal(nextSendTime(wed10, w, 90, zero).toISOString(), wed10.toISOString());
  const late = chicagoTime(2026, 9, 23, 15, 50);
  const t = nextSendTime(late, w, 90, () => 0.99);
  assert.ok(inWindow(t, w), t.toISOString());
});

test("before the window waits for opening; evenings roll to next business day", () => {
  const wed6 = chicagoTime(2026, 9, 23, 6);
  assert.equal(nextSendTime(wed6, w, 90, zero).toISOString(), chicagoTime(2026, 9, 23, 8).toISOString());
  const fri18 = chicagoTime(2026, 9, 25, 18);
  const next = nextSendTime(fri18, w, 90, zero);
  assert.equal(next.toISOString(), chicagoTime(2026, 9, 28, 8).toISOString()); // Monday
  assert.equal(localParts(next).dow, 1);
});

test("weekend rolls to Monday across the DST change", () => {
  const sat = chicagoTime(2026, 10, 31, 12); // DST ends Sun Nov 1 2026
  const next = nextSendTime(sat, w, 90, zero);
  assert.equal(next.toISOString(), "2026-11-02T14:00:00.000Z"); // Mon 08:00 CST
});
