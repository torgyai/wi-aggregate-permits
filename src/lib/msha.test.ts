import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  classifyCommodity,
  commodityFrom,
  normalizeCompanyName,
  normalizeStatus,
  parseMinesText,
  parseMshaDate,
  readMinesArchive,
} from "./msha";

const HEADER =
  "MINE_ID|CURRENT_MINE_NAME|COAL_METAL_IND|CURRENT_MINE_TYPE|CURRENT_MINE_STATUS|CURRENT_STATUS_DT|CURRENT_CONTROLLER_ID|CURRENT_CONTROLLER_NAME|CURRENT_OPERATOR_ID|CURRENT_OPERATOR_NAME|STATE|BOM_STATE_CD|FIPS_CNTY_CD|FIPS_CNTY_NM|PRIMARY_SIC|PRIMARY_CANVASS|PORTABLE_OPERATION|NO_EMPLOYEES|LONGITUDE|LATITUDE|NEAREST_TOWN|CURRENT_CONTROLLER_BEGIN_DT";

const rows = [
  // WI sand & gravel pit, positive longitude (MSHA quirk)
  "4700001|Smith Pit|M|Surface|Active|03/01/2019|C1|Smith Family|O1|Smith Sand & Gravel LLC|WI|47|025|Dane|Sand, Common|Sand & Gravel|N|6|89.40|43.07|Verona|01/15/2026",
  // WI limestone quarry, new mine
  "4700002|North Quarry|M|Surface|New Mine|08/01/2026|C2|Badger Stone|O2|Badger Stone Inc.|WI|47|009|Brown|Stone, Crushed, Broken - Limestone|Stone|Y|12|-88.0|44.5|De Pere|",
  // WI coal row is ignored (no coal in WI, but guard anyway)
  "4700003|Coal Thing|C|Underground|Active|01/01/2020|C3|X|O3|X|WI|47|001|Adams|Coal|Coal|N|1|-89.8|43.9|Friendship|",
  // WI non-aggregate commodity ignored
  "4700004|Peat Bog|M|Surface|Active|01/01/2020|C4|Y|O4|Y|WI|47|001|Adams|Peat|Peat|N|1|-89.8|43.9|Friendship|",
  // Minnesota rows counted toward the controller total, not returned
  "2100001|MN Pit A|M|Surface|Active|01/01/2020|C2|Badger Stone|O9|Badger MN|MN|21|053|Hennepin|Sand, Common|Sand & Gravel|N|3|-93.3|44.9|Minneapolis|",
  "2100002|MN Pit B|M|Surface|Abandoned|01/01/2010|C2|Badger Stone|O9|Badger MN|MN|21|053|Hennepin|Sand, Common|Sand & Gravel|N|0|-93.3|44.9|Minneapolis|",
  // WI industrial sand
  "4700005|Frac Mine|M|Surface|Intermittent|05/05/2024|C5|Frac Co|O5|Frac Co|WI|47|121|Trempealeau|Sand, Industrial NEC|Sand|N|40|-91.4|44.3|Whitehall|",
];

test("parses Wisconsin aggregate sites and skips coal / non-aggregates / other states", () => {
  const r = parseMinesText([HEADER, ...rows].join("\n"));
  assert.equal(r.totalRows, 7);
  assert.deepEqual(
    r.sites.map((s) => s.mshaMineId),
    ["4700001", "4700002", "4700005"],
  );
  const smith = r.sites[0];
  assert.equal(smith.county, "Dane");
  assert.equal(smith.commodity, "SAND_GRAVEL");
  assert.equal(smith.longitude, -89.4);
  assert.equal(smith.operatorName, "Smith Sand & Gravel LLC");
  assert.equal(smith.controllerSince?.toISOString().slice(0, 10), "2026-01-15");
  const quarry = r.sites[1];
  assert.equal(quarry.commodity, "CRUSHED_STONE");
  assert.equal(quarry.mshaStatus, "NEW");
  assert.equal(quarry.portable, true);
  assert.equal(r.sites[2].commodity, "INDUSTRIAL_SAND");
  assert.equal(r.sites[2].county, "Trempealeau");
  // C2 has WI + one active MN site; the abandoned MN site doesn't count.
  assert.equal(r.controllerSiteCounts.get("C2"), 2);
});

test("header order doesn't matter", () => {
  const cols = HEADER.split("|");
  const perm = [...cols].reverse();
  const reorder = (line: string) => {
    const cells = line.split("|");
    return perm.map((c) => cells[cols.indexOf(c)]).join("|");
  };
  const r = parseMinesText([perm.join("|"), reorder(rows[0])].join("\n"));
  assert.equal(r.sites[0].name, "Smith Pit");
});

test("rejects an unrecognised file", () => {
  assert.throws(() => parseMinesText("foo|bar\n1|2"), /Unrecognised/);
});

test("reads zip archives and raw text", async () => {
  const text = [HEADER, rows[0]].join("\n");
  const zipped = zipSync({ "Mines.txt": strToU8(text) });
  assert.equal(await readMinesArchive(zipped), text);
  assert.equal(await readMinesArchive(strToU8(text)), text);
});

test("canvass code decides the class; SIC text refines it", () => {
  assert.equal(commodityFrom("Construction Sand and Gravel", "SandAndGravel", "5"), "SAND_GRAVEL");
  assert.equal(commodityFrom("Crushed, Broken Limestone NEC", "Stone", "6"), "CRUSHED_STONE");
  assert.equal(commodityFrom("Sand, Industrial NEC", "NonMetal", "7"), "INDUSTRIAL_SAND");
  assert.equal(commodityFrom("Salt", "NonMetal", "7"), "OTHER");
  assert.equal(commodityFrom("Iron Ore", "Metal", "8"), "OTHER");
  assert.equal(commodityFrom("Crushed, Broken Traprock", "", ""), "CRUSHED_STONE");
});

test("helpers", () => {
  assert.equal(classifyCommodity("Construction Sand and Gravel"), "SAND_GRAVEL");
  assert.equal(classifyCommodity("Stone, Dimension - Granite"), "DIMENSION_STONE");
  assert.equal(classifyCommodity("Crushed, Broken Dolomite"), "CRUSHED_STONE");
  assert.equal(classifyCommodity("Clay, Common"), "OTHER");
  assert.equal(normalizeStatus("Temporarily Idled"), "TEMP_IDLED");
  assert.equal(normalizeStatus("NonProducing"), "NONPRODUCING");
  assert.equal(normalizeStatus("Abandoned and Sealed"), "ABANDONED");
  assert.equal(parseMshaDate("2024-06-30")?.toISOString().slice(0, 10), "2024-06-30");
  assert.equal(parseMshaDate(""), null);
  assert.equal(normalizeCompanyName("Smith Sand & Gravel, L.L.C."), normalizeCompanyName("SMITH SAND AND GRAVEL LLC"));
});
