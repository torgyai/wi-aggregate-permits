/**
 * DEMO DATA — fictional operators and example.com addresses, for trying the UI.
 * Production uses the MSHA sync + CSV/Apollo contacts instead. Never seed a
 * database you'll send real email from.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeCompanyName } from "../src/lib/msha";
import { rescoreSites } from "../src/lib/prospecting";

const db = new PrismaClient();

const OPERATORS = [
  { name: "Driftless Demo Aggregates LLC", city: "Viroqua", contact: ["Dale", "Hanson", "Owner"], sites: [["Hanson Pit", "Vernon", "SAND_GRAVEL", "ACTIVE", 43.55, -90.89]] },
  { name: "Northwoods Demo Sand & Gravel Inc", city: "Rhinelander", contact: ["Karen", "Lindqvist", "President"], sites: [["County K Pit", "Oneida", "SAND_GRAVEL", "INTERMITTENT", 45.64, -89.41], ["Pelican Lake Pit", "Oneida", "SAND_GRAVEL", "ACTIVE", 45.5, -89.2]] },
  { name: "Kettle Moraine Demo Stone Co", city: "West Bend", contact: ["Tom", "Reinholz", "General Manager"], sites: [["Reinholz Quarry", "Washington", "CRUSHED_STONE", "ACTIVE", 43.42, -88.18]] },
  { name: "Chippewa Valley Demo Materials LLC", city: "Chippewa Falls", contact: ["Amy", "Berg", "Operations Manager"], sites: [["Hwy 29 Pit", "Chippewa", "SAND_GRAVEL", "NEW", 44.94, -91.33]] },
  { name: "Fox River Demo Excavating Inc", city: "Kaukauna", contact: ["Mike", "Vandenberg", "Owner"], sites: [["Vandenberg Pit", "Outagamie", "SAND_GRAVEL", "ACTIVE", 44.29, -88.27], ["Little Chute Pit", "Outagamie", "SAND_GRAVEL", "TEMP_IDLED", 44.28, -88.31]] },
  { name: "Trempealeau Demo Silica LLC", city: "Whitehall", contact: ["Greg", "Olson", "Plant Manager"], sites: [["Whitehall Sand Mine", "Trempealeau", "INDUSTRIAL_SAND", "INTERMITTENT", 44.37, -91.32]] },
  { name: "Door Peninsula Demo Quarry Inc", city: "Sturgeon Bay", contact: null, sites: [["Bayview Quarry", "Door", "CRUSHED_STONE", "ACTIVE", 44.83, -87.38]] },
  { name: "Badger Demo Construction Co", city: "Janesville", contact: ["Lisa", "Nguyen", "Environmental Manager"], sites: [["Rock River Pit", "Rock", "SAND_GRAVEL", "ACTIVE", 42.68, -89.02]] },
] as const;

async function main() {
  const existing = await db.site.count();
  if (existing > 0 && !process.argv.includes("--force")) {
    console.log(`Database already has ${existing} sites; skipping demo seed (use --force to add anyway).`);
    return;
  }
  let n = 0;
  for (const op of OPERATORS) {
    const company = await db.company.create({
      data: { name: op.name, normalizedName: normalizeCompanyName(op.name), city: op.city, state: "WI", source: "MANUAL", notes: "DEMO DATA" },
    });
    if (op.contact) {
      const [first, last, title] = op.contact;
      await db.contact.create({
        data: {
          companyId: company.id,
          firstName: first,
          lastName: last,
          title,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
          source: "MANUAL",
        },
      });
    }
    for (const [name, county, commodity, status, lat, lon] of op.sites) {
      const site = await db.site.create({
        data: {
          name,
          companyId: company.id,
          county,
          commodity,
          mshaStatus: status,
          isNewSite: status === "NEW",
          latitude: lat,
          longitude: lon,
          mshaMineId: `47DEMO${String(++n).padStart(2, "0")}`,
          employees: 4 + n * 3,
          portable: commodity === "CRUSHED_STONE",
        },
      });
      if (name === "Rock River Pit") {
        await db.signal.create({
          data: {
            siteId: site.id,
            companyId: company.id,
            type: "OWNERSHIP_CHANGE",
            title: "Controller change: Badger Demo Construction Co",
            detail: "Demo signal",
            weight: 25,
          },
        });
      }
      if (name === "Reinholz Quarry") {
        await db.signal.create({
          data: { siteId: site.id, companyId: company.id, type: "HEARING_NOTICE", title: "CUP hearing: quarry expansion (demo)", weight: 25 },
        });
      }
    }
  }
  const scored = await rescoreSites();
  console.log(`Seeded ${OPERATORS.length} demo operators, ${n} sites (${scored} scored).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
