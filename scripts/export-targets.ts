/** Writes docs/target-accounts.md from src/lib/target-accounts.ts: npx tsx scripts/export-targets.ts */
import { writeFileSync } from "node:fs";
import { TARGET_ACCOUNTS, TARGET_TOTALS } from "../src/lib/target-accounts";
import { TIERS } from "../src/lib/pricing";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const lines: string[] = [
  "# 40 Wisconsin target accounts",
  "",
  "Researched September 2026 from public sources (company sites, county meeting summaries, local news). Company-level facts only. Prices are estimates from the tier model, to confirm on the discovery call. **Loading these into the app adds no contacts and sends nothing.**",
  "",
  "## Pricing tiers",
  "",
  "| Tier | Name | Price | When |",
  "|---|---|---|---|",
  ...Object.entries(TIERS).map(([k, t]) => `| ${k} | ${t.name} | ${t.range[0] === t.range[1] ? usd(t.range[0]) : `${usd(t.range[0])}–${usd(t.range[1])}`} | ${t.description} |`),
  "",
  "Monthly compliance plan: $750 base + $350 per extra site (quarries +$500, industrial sand $2,000+), capped at $4,000.",
  "",
  "## Totals",
  "",
  `- Package value, all 40: **${usd(TARGET_TOTALS.packages)}**`,
  `- Compliance plans if all sign: **${usd(TARGET_TOTALS.retainerMonthly)}/mo** (${usd(TARGET_TOTALS.retainerMonthly * 12)}/yr)`,
  `- At a 20% win rate: ~${usd(TARGET_TOTALS.packages * 0.2)} in packages + ~${usd(TARGET_TOTALS.retainerMonthly * 12 * 0.2)}/yr recurring`,
  `- Priority (fit 4–5 with a live trigger): ${TARGET_TOTALS.priority.length} accounts, ${usd(TARGET_TOTALS.priority.reduce((a, t) => a + t.price, 0))} — ${TARGET_TOTALS.priority.map((t) => t.name).join("; ")}`,
  "",
  "## Summary table",
  "",
  "| # | Company | County | Type | Ownership | Fit | Tier | Package | Plan/mo | Live trigger |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...TARGET_ACCOUNTS.map((t) => `| ${t.n} | ${t.name} | ${t.county} | ${t.commodity.replace("_", " ").toLowerCase()} | ${t.ownership} | ${t.fit}/5 | ${t.tier} | ${usd(t.price)} | ${t.retainer ? usd(t.retainer) : "—"} | ${t.trigger ? "yes" : "—"} |`),
  "",
  "## Account detail",
  "",
];
for (const t of TARGET_ACCOUNTS) {
  lines.push(
    `### ${t.n}. ${t.name}`,
    "",
    `- **Where:** ${t.hq}, ${t.county} County (${t.region})${t.website ? ` · ${t.website}` : ""}`,
    `- **What they do:** ${t.what}`,
    `- **Size / ownership:** ${t.size} · ${t.ownership}`,
    `- **Trigger:** ${t.trigger ?? "none found — fit-based"}`,
    `- **Fit:** ${t.fit}/5`,
    `- **Scope:** ${t.scope}`,
    `- **Price:** ${usd(t.price)} (${t.tier} ${TIERS[t.tier].name})${t.retainer ? ` + ${usd(t.retainer)}/mo compliance plan` : ""}`,
    `- **Outreach angle:** "${t.angle}"`,
    ...(t.caution ? [`- **Caution:** ${t.caution}`] : []),
    `- **Sources:** ${t.sources.join(" · ")}`,
    "",
  );
}
writeFileSync("docs/target-accounts.md", lines.join("\n"));
console.log("wrote docs/target-accounts.md");
