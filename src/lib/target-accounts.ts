/**
 * Hand-researched target accounts (web research, Sept 2026). Company-level facts
 * from public sources only — no personal contact data. Loaded from the Target
 * accounts page; loading never emails anyone (they have no contacts until you add
 * them, and autopilot only works leads with a contact).
 *
 * Pricing uses the tier model in src/lib/pricing.ts. Figures are estimates to
 * confirm on the discovery call, not quotes.
 */
export type TargetAccount = {
  n: number;
  name: string;
  region: string;
  hq: string;
  county: string;
  website?: string;
  commodity: "SAND_GRAVEL" | "CRUSHED_STONE" | "INDUSTRIAL_SAND" | "DIMENSION_STONE";
  what: string;
  size: string;
  ownership: "Independent" | "Regional group" | "National / large";
  trigger: string | null;
  triggerType?: "HEARING_NOTICE" | "EXPANSION" | "OWNERSHIP_CHANGE" | "NEW_MINE" | "REACTIVATION";
  fit: 1 | 2 | 3 | 4 | 5;
  scope: string;
  tier: "T1" | "T2" | "T3" | "T4";
  price: number;
  retainer: number;
  angle: string;
  sources: string[];
  caution?: string;
};

export const TARGET_ACCOUNTS: TargetAccount[] = [
  {
    n: 1, name: "Todd's Redi-Mix Concrete, LLC", region: "North / Northwest", hq: "Hayward", county: "Sawyer", website: "toddsredimix.com",
    commodity: "SAND_GRAVEL", what: "Ready-mix + aggregates: 7 ready-mix plants, 9 aggregate locations (Hayward, Rice Lake, Ashland areas).", size: "Family-owned", ownership: "Regional group",
    trigger: "2026: Sawyer County Zoning Committee denied (4–1) an 80-acre rezone for pit expansion; CUP tabled, request later withdrawn. Residents cited crusher noise and incomplete reclamation.", triggerType: "HEARING_NOTICE",
    fit: 5, scope: "9-pit NR 135 reclamation audit/catch-up; rebuild expansion application (rezone/CUP) with a defensible record; crusher air, WPDES, SPCC.", tier: "T4", price: 90000, retainer: 3000,
    angle: "Your expansion was lost on reclamation optics. We'll clean up the 9-site reclamation record first so the next Sawyer County application is built to be approved.",
    sources: ["https://citizenportal.ai/articles/8552312/Wisconsin/Sawyer-County/Zoning-panel-denies-Todds-Ready-Mix-80acre-rezone-after-sustained-public-opposition", "https://toddsredimix.com/locations/"],
  },
  {
    n: 2, name: "Janak & Sons, LLC", region: "North / Northwest", hq: "Phillips", county: "Price", website: "janakandsons.com",
    commodity: "SAND_GRAVEL", what: "Logging, dozing, excavating; new long-term gravel pit at N9510 E. Solberg Lake Rd, Town of Worcester.", size: "Family-owned since the 1970s", ownership: "Independent",
    trigger: "May–June 2026: new-pit CUP approved with 15 conditions after an opposed hearing; reclamation plan before the county.", triggerType: "NEW_MINE",
    fit: 5, scope: "Tracking compliance with 15 CUP conditions; NR 135 permit + financial assurance; WPDES; SPCC; MSHA ID/training plan.", tier: "T2", price: 40000, retainer: 750,
    angle: "You won the CUP — now 15 conditions and a watchful neighborhood. We run the permits and the calendar so a condition never ends up back in front of the committee.",
    sources: ["https://citizenportal.ai/articles/9240912/wisconsin/price-county/price-county-committee-approves-conditions-for-janak-sons-gravel-pit-amends-hours", "https://www.waow.com/news/proposed-gravel-and-asphalt-plants-getting-drawbacks-from-locals-in-phillips-of-price-county/article_bd5d0e5b-79f6-4201-a417-807cc3c6e062.html"],
  },
  {
    n: 3, name: "H & S Excavating (Blomberg Pit)", region: "North / Northwest", hq: "Sawyer County", county: "Sawyer",
    commodity: "SAND_GRAVEL", what: "Excavating; one 31-acre sand & gravel pit (15 permitted, ~10 in use).", size: "Unknown", ownership: "Independent",
    trigger: "2025: 5-year CUP renewal with a new 12-crushing-days/year cap; CD as financial assurance; county flagged NR 135 transfer on any sale.", triggerType: "HEARING_NOTICE",
    fit: 3, scope: "Crushing-day log + portable crusher air coverage; SWPPP/SPCC; financial assurance reset.", tier: "T1", price: 15000, retainer: 750,
    angle: "Twelve crushing days a year is easy to exceed without a log. We set up the tracking and the air paperwork.",
    sources: ["https://citizenportal.ai/articles/6555704/Wisconsin/Sawyer-County/Zoning-committee-renews-Blomberg-Pit-nonmetallic-mining-permit-with-tighter-crushing-hours-limit"],
  },
  {
    n: 4, name: "Hopkins Sand & Gravel, Inc.", region: "North / Northwest", hq: "Webster", county: "Burnett", website: "hopkinsgravel.com",
    commodity: "SAND_GRAVEL", what: "Sand & gravel, ready-mix, custom crushing, excavation; Webster and Minong WI, Beroun MN.", size: "Family-owned since 1946", ownership: "Independent",
    trigger: null, fit: 3, scope: "Two-county NR 135 + financial assurance review; crusher air; WPDES/SPCC catch-up.", tier: "T1", price: 20000, retainer: 1500,
    angle: "Eighty years of pits in Burnett and Washburn counties means old reclamation plans — we'll modernize them before the county asks.",
    sources: ["https://hopkinsgravel.com/about/"],
  },
  {
    n: 5, name: "Blue Rock Quarry (landowner group)", region: "North / Northwest", hq: "Dresser", county: "Polk", website: "bluerockquarry.com",
    commodity: "CRUSHED_STONE", what: "Proposed trap-rock quarry on ~200 acres east of Trollhaugen; operator not yet chosen.", size: "Unknown", ownership: "Independent",
    trigger: "CUP granted (2022); Polk County Circuit Court upheld it against a neighbor group's appeal; 'six interested operators' waiting on remaining permits (ruling date unconfirmed).", triggerType: "NEW_MINE",
    fit: 4, scope: "Full quarry package — NR 135 + FA, blasting (SPS 307), crusher air, WPDES, dewatering review — packaged to hand to the chosen operator.", tier: "T3", price: 65000, retainer: 1000,
    angle: "You won the CUP fight. A permit-ready package makes the site worth more to the six operators you're choosing between.",
    sources: ["https://www.osceolasun.com/news/court-clears-way-for-blue-rock-quarry-to-proceed/article_35b6269f-c1d6-4913-bca9-d813482b36cc.html", "https://bluerockquarry.com/"],
  },
  {
    n: 6, name: "Pitlik & Wick, Inc.", region: "North / Northwest", hq: "Eagle River", county: "Vilas", website: "pitlikandwick.com",
    commodity: "SAND_GRAVEL", what: "Asphalt paving, excavation; multiple portable crushing spreads across northern WI and the U.P.", size: "Since 1952", ownership: "Independent",
    trigger: null, fit: 3, scope: "Portable crusher air permits + 20-day relocation notices; NSPS OOO test records; SPCC for mobile fuel; NR 135 for owned pits.", tier: "T1", price: 25000, retainer: 2000,
    angle: "Several portable spreads moving between WI and MI means relocation notices and OOO records that pile up — we handle that paperwork so crews keep crushing.",
    sources: ["https://pitlikandwick.com/services/aggregate-crushing/"],
  },
  {
    n: 7, name: "Merrill Gravel & Construction", region: "North / Northwest", hq: "Merrill", county: "Lincoln", website: "merrillgravel.com",
    commodity: "SAND_GRAVEL", what: "Highway, utility and site construction; gravel crushing; asphalt milling.", size: "Family-owned since 1946", ownership: "Independent",
    trigger: null, fit: 3, scope: "Pit permit + financial assurance audit; crusher air; SWPPP/SPCC.", tier: "T1", price: 20000, retainer: 1500,
    angle: "A contractor that owns its pits should spend its time bidding work — we handle NR 135 and the crusher paperwork on a flat fee.",
    sources: ["https://www.merrillgravel.com/"],
  },
  {
    n: 8, name: "Wissota Sand & Gravel Co.", region: "North / Northwest", hq: "Eau Claire / Richfield (unclear)", county: "Chippewa", website: "wissotasandgravel.com",
    commodity: "SAND_GRAVEL", what: "Aggregates: Richfield, Haugen, Hayward, Ashland, Chippewa Falls WI + Winona MN.", size: "Founded 1916; Larson family, 3rd generation", ownership: "Regional group",
    trigger: null, fit: 3, scope: "Multi-site NR 135 + FA program across ~5 WI counties; crusher/wash plant air and WPDES; SPCC.", tier: "T4", price: 90000, retainer: 3000,
    angle: "Six sites under five different county regulators — one compliance calendar.",
    sources: ["https://www.wissotasandgravel.com/about_us.phtml"], caution: "Confirm HQ (Richfield vs Eau Claire).",
  },
  {
    n: 9, name: "Pattison Sand Company, LLC", region: "West / frac-sand", hq: "Clayton, IA (WI mine: Bridgeport)", county: "Crawford", website: "pattisonsand.com",
    commodity: "INDUSTRIAL_SAND", what: "Industrial (frac) sand since 2007; construction aggregate since 2017; rail and barge.", size: "Pattison family-owned", ownership: "Independent",
    trigger: "Rail track extension to grow aggregate shipping (date unconfirmed, ~2024).", triggerType: "EXPANSION",
    fit: 3, scope: "WI industrial sand program: NR 135 phase updates, air (dryers/processing), WPDES process water, high-cap wells.", tier: "T4", price: 90000, retainer: 2500,
    angle: "Shifting a frac-sand site toward aggregate changes your air, water and reclamation assumptions — we re-baseline the Bridgeport permits.",
    sources: ["https://pattisonsand.com/proppants/"],
  },
  {
    n: 10, name: "Smart Sand, Inc.", region: "West / frac-sand", hq: "Texas (WI mines: Oakdale, Blair)", county: "Monroe", website: "smartsand.com",
    commodity: "INDUSTRIAL_SAND", what: "Northern White frac sand; Oakdale 1,250 acres; 5.4M tons sold in 2025.", size: "Public company", ownership: "National / large",
    trigger: "Bought the idle Hi-Crush Blair mine 3/2024 (closed since 2020): reactivation + permit transfer.", triggerType: "OWNERSHIP_CHANGE",
    fit: 2, scope: "Overflow support on Blair: reactivation, NR 135 update, WPDES.", tier: "T4", price: 90000, retainer: 2500,
    angle: "Extra hands for the Blair restart paperwork so your Oakdale team stays on Oakdale.",
    sources: ["https://www.wpr.org/economy/idled-trempealeau-county-frac-sand-mine-has-been-purchased-smart-sand-inc"], caution: "Green Tier participant; likely in-house staff.",
  },
  {
    n: 11, name: "Superior Silica Sands (Emerge Energy Services)", region: "West / frac-sand", hq: "New Auburn / Barron / Chetek", county: "Chippewa",
    commodity: "INDUSTRIAL_SAND", what: "Frac sand; up to five Chippewa/Barron mines at peak.", size: "Unknown", ownership: "National / large",
    trigger: "2019–20 bankruptcy; bond disputes with Chippewa County; reclaiming Town of Arland sites; reported back in compliance.", triggerType: "REACTIVATION",
    fit: 3, scope: "Multi-mine final reclamation + financial assurance release program.", tier: "T4", price: 90000, retainer: 2500,
    angle: "Every acre reclaimed and certified releases bond money — we run the release schedule.",
    sources: ["https://www.wpr.org/economy/frac-sand-company-emerges-bankruptcy-back-compliance-chippewa-county"], caution: "Verify current operating status.",
  },
  {
    n: 12, name: "Hi-Crush Whitehall facility (in liquidation)", region: "West / frac-sand", hq: "Whitehall", county: "Trempealeau",
    commodity: "INDUSTRIAL_SAND", what: "Idled frac sand mine and plant (opened 2014).", size: "Unknown", ownership: "National / large",
    trigger: "Listed for liquidation/auction; buyer unconfirmed.", triggerType: "OWNERSHIP_CHANGE",
    fit: 2, scope: "Buyer-side: NR 135 transfer + FA reset, or a final reclamation plan.", tier: "T1", price: 25000, retainer: 750,
    angle: "Buying Whitehall? We handle the NR 135 transfer, financial assurance and the reactivate-vs-reclaim call.",
    sources: ["https://www.wpr.org/economy/frac-sand-company-liquidating-western-wisconsin-mine"], caution: "Owner uncertain — monitor for a buyer.",
  },
  {
    n: 13, name: "Badger Mining Corporation", region: "West / frac-sand", hq: "Berlin", county: "Green Lake", website: "badgerminingcorp.com",
    commodity: "INDUSTRIAL_SAND", what: "Silica sand (foundry, frac, glass, recreation); plants at Fairwater, Taylor, Alma Center, Merrillan.", size: "Family-owned, 3rd–4th generation", ownership: "Independent",
    trigger: null, fit: 2, scope: "Overflow: reclamation phase updates, high-cap well renewals.", tier: "T4", price: 90000, retainer: 2500,
    angle: "Surge capacity for a Green Tier team: renewals and reclamation phase work across four sites.",
    sources: ["https://badgerminingcorp.com/about-us/"], caution: "Strong EMS; likely has staff.",
  },
  {
    n: 14, name: "Cemstone Ready Mix, Inc. (Spring Valley Quarry)", region: "West / frac-sand", hq: "Minnesota (quarry: Spring Valley)", county: "Pierce", website: "cemstone.com",
    commodity: "CRUSHED_STONE", what: "Ready-mix; ~200-acre dolomite quarry, ~20M tons reserves, crushing + washing.", size: "Regional MN group", ownership: "Regional group",
    trigger: "Acquired the County Materials Spring Valley quarry 6/2024: NR 135 transfer, FA, air/WPDES transfers.", triggerType: "OWNERSHIP_CHANGE",
    fit: 3, scope: "Confirm post-acquisition transfers; align WI permits to MN practice.", tier: "T1", price: 25000, retainer: 1000,
    angle: "Your first Wisconsin quarry — we know WDNR and Pierce County better than your MN team does.",
    sources: ["https://cemstone.com/new-cemstone-location-spring-valley/"],
  },
  {
    n: 15, name: "Hoffman Construction Company", region: "West / frac-sand", hq: "Black River Falls", county: "Jackson",
    commodity: "SAND_GRAVEL", what: "Heavy highway grading contractor and aggregate provider.", size: "Founded 1927", ownership: "Independent",
    trigger: null, fit: 3, scope: "DOT-project borrow sites / temporary pits + owned pit permitting.", tier: "T2", price: 40000, retainer: 1000,
    angle: "Temporary DOT borrow pits still need NR 135 and WPDES — we turn them around on your project schedule.",
    sources: ["https://dailyreporter.com/2018/06/07/hoffman-carries-on-the-dirt-moving-tradition/"],
  },
  {
    n: 16, name: "Kohner Materials", region: "West / frac-sand", hq: "Winona, MN (WI office: Independence)", county: "Trempealeau", website: "kohnermaterials.com",
    commodity: "SAND_GRAVEL", what: "Two sand & gravel companies, 9 ready-mix plants; WI pits at Independence, Osseo, Arcadia.", size: "~80 employees; family since 1959", ownership: "Regional group",
    trigger: null, fit: 3, scope: "Compliance program for 3 WI pits (NR 135, WPDES, SPCC).", tier: "T1", price: 25000, retainer: 1500,
    angle: "MN-headquartered with three Wisconsin pits — let us own the Wisconsin side.",
    sources: ["https://www.kohnermaterials.com/about-us"],
  },
  {
    n: 17, name: "DB Quarry / Chopper Farms LLC", region: "Central", hq: "Town of Dewey", county: "Portage",
    commodity: "CRUSHED_STONE", what: "Quarry with seasonal crushing (~20 years).", size: "Unknown", ownership: "Independent",
    trigger: "2026: seeking a 20-year special-exception extension; Town of Dewey plan commission recommended denial 3–1; neighbors allege off-hours loading, missing containment, off-season crushing.", triggerType: "HEARING_NOTICE",
    fit: 5, scope: "Fix compliance gaps (SPCC containment, hours log), support the renewal, NR 135 plan update, crusher/air records.", tier: "T3", price: 55000, retainer: 1000,
    angle: "The neighbors are documenting violations — we'll document compliance: containment, logs and a clean renewal record.",
    sources: ["https://citizenportal.ai/articles/7882288/Wisconsin/Portage-County/Neighbors-and-planning-commission-oppose-20-year-quarry-extension-owner-seeks-more-flexibility-on-hours"],
  },
  {
    n: 18, name: "Kopplin & Kinas Co., Inc.", region: "Central", hq: "Green Lake", county: "Green Lake", website: "kkci.us",
    commodity: "CRUSHED_STONE", what: "Excavation, road building, sand & gravel; operator of the new 80-acre County K limestone quarry near Ripon.", size: "Owner-operated", ownership: "Independent",
    trigger: "2024: County K Quarry CUP approved over Green Lake Conservancy opposition (springs, trout streams).", triggerType: "NEW_MINE",
    fit: 5, scope: "New limestone quarry: NR 135 + FA, blasting, crusher air, WPDES/groundwater protection near springs, MSHA.", tier: "T3", price: 65000, retainer: 1000,
    angle: "The Conservancy will read every groundwater sample — we build the permit and monitoring record that holds up.",
    sources: ["https://www.riponpress.com/news/county-k-quarry-receives-green-light/article_f20eb7bc-2d85-11ef-b526-f35ea1d7f1de.html"],
  },
  {
    n: 19, name: "Wimme Sand & Gravel", region: "Central", hq: "Stevens Point", county: "Portage", website: "wimmesandandgravel.com",
    commodity: "SAND_GRAVEL", what: "Sand & gravel, decorative and landscape stone (30+ products).", size: "Founded 1947; 3rd generation", ownership: "Independent",
    trigger: null, fit: 3, scope: "SWPPP/SPCC catch-up; financial assurance + reclamation plan review.", tier: "T1", price: 20000, retainer: 750,
    angle: "A new generation is a good moment for a clean permit file.",
    sources: ["https://www.wimmesandandgravel.com/about"],
  },
  {
    n: 20, name: "Earth Inc.", region: "Central", hq: "Town of McMillan", county: "Marathon",
    commodity: "SAND_GRAVEL", what: "Gravel pit/quarry operating since 2000.", size: "Unknown", ownership: "Independent",
    trigger: "2019 5-year CUP conversion drew ~80 objectors; renewal cycle suggests ~2024–25.", triggerType: "HEARING_NOTICE",
    fit: 3, scope: "CUP renewal + reclamation plan update (fish-pond end use).", tier: "T1", price: 20000, retainer: 750,
    angle: "Your 5-year CUP is due — let's avoid a repeat of that 80-person meeting.",
    sources: ["https://wausaupilotandreview.com/2019/04/11/residents-oppose-marathon-county-gravel-pit-permit/"], caution: "Trigger is from 2019; verify status.",
  },
  {
    n: 21, name: "Griesbach Concrete LLC", region: "Northeast", hq: "Appleton area", county: "Outagamie",
    commodity: "CRUSHED_STONE", what: "Concrete/ready-mix; new limestone quarry off County A, Town of Center (20-year project, 10-year first permit).", size: "Small", ownership: "Independent",
    trigger: "11/2025: Outagamie County approved the special exception after delays, with a half-mile well guarantee condition.", triggerType: "NEW_MINE",
    fit: 5, scope: "New quarry: NR 135 + FA, baseline well survey/guarantee program, blasting, crusher air, WPDES, MSHA.", tier: "T3", price: 70000, retainer: 1000,
    angle: "The half-mile well guarantee is your biggest liability — we set up the baseline well survey on day one.",
    sources: ["https://fox11online.com/news/local/outagamie-county-approves-new-gravel-quarry-in-town-of-center-despite-community-pushback-limestone-gravel-mine-zoning-committee-public-comment-outcry-support"],
  },
  {
    n: 22, name: "McKeefry & Sons, Inc.", region: "Northeast", hq: "Pulaski", county: "Brown",
    commodity: "CRUSHED_STONE", what: "Site development, excavating, trucking, demolition; crushed-stone quarry.", size: "Family-owned since 1971", ownership: "Independent",
    trigger: null, fit: 3, scope: "Quarry tune-up: blasting records, crusher air, SPCC, NR 135 plan refresh.", tier: "T1", price: 25000, retainer: 1000,
    angle: "A contractor running its own quarry needs a flat-fee environmental back office.",
    sources: ["https://pulaskichamber.org/member-directory/name/mckeefry-sons-inc/"],
  },
  {
    n: 23, name: "Aggrecon, Ltd.", region: "Northeast", hq: "Kiel", county: "Manitowoc",
    commodity: "CRUSHED_STONE", what: "Sand & gravel + limestone quarry (~80 acres).", size: "Owner-operated", ownership: "Independent",
    trigger: "Long-running push for a 60-ft-deep quarry expansion; new pit added to WisDOT's 2026 source list (4/2025).", triggerType: "EXPANSION",
    fit: 4, scope: "Expansion/new-pit permitting (NR 135 amendment, CUP/variance), dewatering + high-cap, blasting.", tier: "T3", price: 55000, retainer: 1000,
    angle: "Your new 2025 pit and the quarry expansion belong in one permit strategy.",
    sources: ["https://wisconsindot.gov/Documents/doing-bus/eng-consultants/cnslt-rsrces/tools/appr-prod/ap-current/225-aggrpt.pdf"],
  },
  {
    n: 24, name: "Kiel Sand & Gravel, Inc.", region: "Northeast", hq: "Kiel", county: "Manitowoc", website: "kielsandandgravelinc.com",
    commodity: "SAND_GRAVEL", what: "Mason sand, construction aggregates, landscape stone.", size: "Established 1959", ownership: "Independent",
    trigger: "Business-broker 'tombstone' page suggests a possible sale (unverified).", triggerType: "OWNERSHIP_CHANGE",
    fit: 3, scope: "If sold: NR 135 transfer + FA reset; SWPPP/SPCC.", tier: "T1", price: 20000, retainer: 750,
    angle: "If ownership changed hands, NR 135 requires a transfer — we make sure it's done cleanly.",
    sources: ["https://www.cornerstone-business.com/tombstone/kiel-sand-gravel/"], caution: "Confirm ownership change.",
  },
  {
    n: 25, name: "J&N Stone / Rural Excavating", region: "Southwest / Driftless", hq: "Lancaster", county: "Grant", website: "jnstone-ruralexcavating.com",
    commodity: "CRUSHED_STONE", what: "Crushed limestone at 8 quarries; excavation; ready-mix.", size: "Yager family since 2001", ownership: "Independent",
    trigger: "Quarry count keeps growing — recurring new-site permitting.", triggerType: "EXPANSION",
    fit: 4, scope: "8-quarry program: NR 135 + FA, blasting, portable crusher air, SPCC.", tier: "T4", price: 90000, retainer: 3000,
    angle: "Eight quarries in 20 years is fast growth — we bring the permit files up to the same pace.",
    sources: ["https://j-nstone.com/our-history"],
  },
  {
    n: 26, name: "Ray Zobel & Sons, Inc.", region: "Southwest / Driftless", hq: "Reedsburg", county: "Sauk",
    commodity: "CRUSHED_STONE", what: "Demolition, excavating, limestone quarry (Towns of Reedsburg / Ironton).", size: "Unknown", ownership: "Independent",
    trigger: "Sauk County hearing on renewal of the special exception and reclamation permit.", triggerType: "HEARING_NOTICE",
    fit: 4, scope: "Renewal support; reclamation plan update; blasting + crusher records.", tier: "T1", price: 25000, retainer: 750,
    angle: "Every Sauk County renewal reopens the hearing — we make the next one routine.",
    sources: ["https://www.co.sauk.wi.us/landconservation/notice-public-hearing-ray-zobel-sons-requesting-renewal-permit-operate-limestone"],
  },
  {
    n: 27, name: "Bindl Bauer Limestone LLC", region: "Southwest / Driftless", hq: "Spring Green", county: "Sauk",
    commodity: "CRUSHED_STONE", what: "Limestone quarry, Town of Bear Creek.", size: "Family operation", ownership: "Independent",
    trigger: "Sauk County hearing on permit renewal.", triggerType: "HEARING_NOTICE",
    fit: 4, scope: "Renewal; reclamation + FA update; blasting and crusher compliance.", tier: "T1", price: 20000, retainer: 750,
    angle: "A small quarry with a county renewal on the calendar — we handle the file for a flat fee.",
    sources: ["https://www.co.sauk.wi.us/landconservation/notice-public-hearing-joe-bauer-bindl-bauer-limestone-fred-lins-requesting-renewal"],
  },
  {
    n: 28, name: "C & C Thompson", region: "Southwest / Driftless", hq: "Franklin Township", county: "Vernon",
    commodity: "CRUSHED_STONE", what: "Quarry.", size: "Unknown", ownership: "Independent",
    trigger: "2025: new reclamation plan on public notice; county holds an irrevocable LOC. Vernon County reports numerous quarries out of compliance.", triggerType: "NEW_MINE",
    fit: 3, scope: "New-quarry operating compliance: MSHA, SPCC, crusher air.", tier: "T1", price: 15000, retainer: 750,
    angle: "New plan approved — now we set up the operating compliance around it.",
    sources: ["https://citizenportal.ai/articles/6196750/wisconsin/vernon-county/committee-hears-update-on-three-quarry-reclamation-plans-public-notice-open-through-june-20"], caution: "Low confidence: single source.",
  },
  {
    n: 29, name: "Wingra Stone Company / Wingra Redi-Mix", region: "South-central", hq: "Madison / Fitchburg", county: "Dane", website: "wingrastone.com",
    commodity: "CRUSHED_STONE", what: "Aggregates + ready-mix: 10 pits/quarries, 4 portable crushers, 3 wash plants.", size: "Founded 1928; 3rd-gen Shea family", ownership: "Regional group",
    trigger: null, fit: 3, scope: "10-site program: wash-plant WPDES, portable crusher air, NR 135 + FA, high-cap wells.", tier: "T4", price: 90000, retainer: 3000,
    angle: "Three wash plants means process-water permits — we consolidate WPDES and reclamation for all 10 sites.",
    sources: ["https://www.wingrastone.com/about-us/history/"],
  },
  {
    n: 30, name: "R.G. Huston Company, Inc.", region: "South-central", hq: "Cottage Grove", county: "Dane", website: "rghuston.com",
    commodity: "CRUSHED_STONE", what: "Earthwork/utilities; several quarries/pits (CTH N, Gaston Road); recycling and on-site crushing.", size: "Incorporated 1975", ownership: "Independent",
    trigger: "Town of Cottage Grove hearing 6/1/2026 to renew the Gaston Road Quarry nonmetallic mining permit (annual license).", triggerType: "HEARING_NOTICE",
    fit: 4, scope: "Annual renewal packages; NR 135; crusher + recycling air.", tier: "T4", price: 90000, retainer: 2000,
    angle: "Annual town renewals every June — we build a renewal package you reuse each year.",
    sources: ["https://tn.cottagegrove.wi.gov/news-and-notices/notice-of-june-1-2026-public-hearing-for-2026-27-non-metallic-mining-permits/"],
  },
  {
    n: 31, name: "Yahara Materials, Inc.", region: "South-central", hq: "Waunakee", county: "Dane", website: "yahara.com",
    commodity: "SAND_GRAVEL", what: "Aggregates + custom crushing/washing at 15 Dane County locations.", size: "Since 1955; 2nd-gen family", ownership: "Regional group",
    trigger: null, fit: 3, scope: "15-site compliance program.", tier: "T4", price: 100000, retainer: 4000,
    angle: "Fifteen Dane County sites under Dane County scrutiny — one program, one fee.",
    sources: ["https://www.yahara.com/about-us/"],
  },
  {
    n: 32, name: "Footville Rock & Lime Corporation", region: "South-central", hq: "Brodhead", county: "Rock", website: "footvillerocklimecorp.com",
    commodity: "CRUSHED_STONE", what: "Limestone quarry incl. ag lime.", size: "Quarry since the 1930s; same family since 1974", ownership: "Independent",
    trigger: null, fit: 3, scope: "Blasting/crusher/SPCC tune-up; NR 135 update.", tier: "T1", price: 20000, retainer: 750,
    angle: "Fifty years of family operation — permits ready for the next generation.",
    sources: ["https://footvillerocklimecorp.com/"],
  },
  {
    n: 33, name: "Rock Road Companies, Inc.", region: "South-central", hq: "Janesville", county: "Rock", website: "rockroads.com",
    commodity: "SAND_GRAVEL", what: "Asphalt, paving, site development, aggregates; pits/quarries across southern WI and northern IL.", size: "~200 employees; Kennedy family since 1913", ownership: "Regional group",
    trigger: null, fit: 3, scope: "Multi-site WI/IL program.", tier: "T4", price: 90000, retainer: 3000,
    angle: "Two states, many pits — outsource the Wisconsin NR 135 and WPDES side.",
    sources: ["https://www.rockroads.com/company/locations"], caution: "May have a safety/environmental coordinator.",
  },
  {
    n: 34, name: "Frank Silha & Sons Excavating, Inc.", region: "South-central", hq: "Janesville", county: "Rock", website: "silhaexcavation.com",
    commodity: "SAND_GRAVEL", what: "Site development; 6 Rock County pits (Cronin, M-H Townline, Gunn Quarry, Beloit…).", size: "65+ years; family", ownership: "Independent",
    trigger: null, fit: 4, scope: "6-site NR 135 + FA, WPDES, SPCC, crusher air.", tier: "T4", price: 90000, retainer: 2500,
    angle: "Six pits and a quarry is a real mining operation — one flat-fee compliance program.",
    sources: ["https://www.silhaexcavation.com/"],
  },
  {
    n: 35, name: "Halquist Stone Company", region: "Southeast", hq: "Sussex", county: "Waukesha", website: "halquiststone.com",
    commodity: "DIMENSION_STONE", what: "Dimension/landscape stone, crushed stone, ag lime; 9 WI quarries plus AZ, NV.", size: "Founded 1929; 4th generation", ownership: "Regional group",
    trigger: null, fit: 3, scope: "9-quarry compliance program.", tier: "T4", price: 90000, retainer: 3000,
    angle: "Nine dimension-stone quarries around the state — we take the county paperwork off your hands.",
    sources: ["https://www.gmtoday.com/business/halquist-sells-lisbon-quarry-to-lannon-stone/article_abee66f7-47ac-5e59-afbb-766b3c09cbe2.html"],
  },
  {
    n: 36, name: "Lannon Stone Products, Inc.", region: "Southeast", hq: "Sussex", county: "Waukesha", website: "lannonstone.net",
    commodity: "CRUSHED_STONE", what: "Limestone quarries + gravel pits: West, Sussex, 4 Lisbon sites, Jackson.", size: "3rd-gen Dawson family", ownership: "Independent",
    trigger: "Expansion history: bought the 300-acre ex-Halquist quarry (2020); Lisbon long-range expansion toward neighbors.", triggerType: "EXPANSION",
    fit: 3, scope: "Expansion-phase NR 135 amendments, well monitoring, blasting, dewatering.", tier: "T3", price: 65000, retainer: 2000,
    angle: "The Lisbon expansion moves toward homes — we run the well-monitoring and blasting record.",
    sources: ["https://patch.com/wisconsin/sussex/lannon-stone-seeking-to-expand-quarry-operations"],
  },
  {
    n: 37, name: "Corporate Contractors, Inc. (CCI Bay Pit)", region: "Southeast", hq: "Beloit (unconfirmed)", county: "Walworth", website: "cciwi.com",
    commodity: "SAND_GRAVEL", what: "General contractor; owns a sand & gravel pit at Williams Bay that also takes clean fill and recycled material.", size: "Unknown", ownership: "Independent",
    trigger: null, fit: 3, scope: "Single-pit tune-up: clean-fill acceptance, recycling crusher air, SWPPP.", tier: "T1", price: 15000, retainer: 750,
    angle: "A GC that owns one pit — we're the environmental department you don't have.",
    sources: ["https://www.cciwi.com/cci-announces-acquisition-sand-gravel-pit/"],
  },
  {
    n: 38, name: "Mathy Construction Co. / Milestone Materials", region: "Large / national", hq: "Onalaska", county: "La Crosse", website: "milestonematerials.com",
    commodity: "CRUSHED_STONE", what: "Asphalt + aggregates; many pits and quarries.", size: "Large, family-owned", ownership: "National / large",
    trigger: "2025–26: Adams County pit expansion approved; Sawyer County Hirschfeld Pit CUP approved; Skilly Pit hot-mix plant denied; new Round Lake pit CUP pending.", triggerType: "EXPANSION",
    fit: 2, scope: "Project-by-project overflow on contested northern pit CUPs.", tier: "T2", price: 40000, retainer: 0,
    angle: "Surge help on the contested northern Wisconsin pit CUPs.",
    sources: ["https://citizenportal.ai/articles/10048404/Wisconsin/Sawyer-County/Zoning-committee-approves-Hirschfeld-Pit-CUP-for-location-and-operation-with-conditions"],
  },
  {
    n: 39, name: "Michels Road & Stone (Michels Corporation)", region: "Large / national", hq: "Brownsville", county: "Dodge", website: "michels.us",
    commodity: "CRUSHED_STONE", what: "'Largest stone and aggregate producer in Wisconsin'; 100+ pits and quarries.", size: "Large", ownership: "National / large",
    trigger: null, fit: 1, scope: "Overflow only.", tier: "T2", price: 40000, retainer: 0,
    angle: "One conversation with their environmental manager about overflow capacity.",
    sources: ["https://www.michels.us/michels-road-stone-inc/solutions/aggregates/"],
  },
  {
    n: 40, name: "Payne & Dolan, Inc. (Walbec Group)", region: "Large / national", hq: "Waukesha", county: "Waukesha", website: "walbecgroup.com",
    commodity: "CRUSHED_STONE", what: "Aggregates + asphalt; Walbec runs 100+ mines incl. Waukesha Lime & Stone and a Franklin quarry.", size: "Large", ownership: "National / large",
    trigger: "A DNR audit found the City of Franklin must update its NR 135 permitting — may drive new plan submittals at the Franklin quarry (inference).",
    fit: 1, scope: "Overflow only.", tier: "T2", price: 40000, retainer: 0,
    angle: "Franklin's NR 135 overhaul will ask for new plan submittals — we can absorb the volume.",
    sources: ["https://citizenportal.ai/articles/6712772/Wisconsin/Milwaukee-County/Franklin-City/DNR-audit-finds-Franklin-must-update-reclamation-permitting-and-ordinances-to-meet-NR-135-requirements"],
  },
];

export const TARGET_TOTALS = {
  packages: TARGET_ACCOUNTS.reduce((a, t) => a + t.price, 0),
  retainerMonthly: TARGET_ACCOUNTS.reduce((a, t) => a + t.retainer, 0),
  priority: TARGET_ACCOUNTS.filter((t) => t.fit >= 4 && t.trigger),
};
