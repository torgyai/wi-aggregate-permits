/**
 * Deterministic fallback copy. Used when no Claude key is set or the AI call
 * fails, and as the style reference in the AI prompt. Plain text, short,
 * specific to the site — no links in the first touch (deliverability).
 */
import type { LeadContext } from "./context";
import type { SequenceStep } from "./sequence";

const first = (c: LeadContext) => c.contact.firstName?.trim() || "there";
const siteRef = (c: LeadContext) =>
  c.site ? `${c.site.name}${c.site.county ? ` in ${c.site.county} County` : ""}` : `${c.company.name}'s sites`;
const topNeeds = (c: LeadContext, n = 3) =>
  c.needs
    .filter((x) => x.status === "REQUIRED" || x.status === "LIKELY")
    .slice(0, n)
    .map((x) => x.shortName);

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function openerHook(c: LeadContext): string {
  const where = siteRef(c);
  switch (c.angle) {
    case "OWNERSHIP_CHANGE":
      return `I saw MSHA now lists a new controller for ${where}. When a pit changes hands, the reclamation permit, financial assurance, WPDES coverage and MSHA legal ID all have to follow the new operator — and counties don't always flag it until the annual report.`;
    case "NEW_MINE":
      return `I noticed ${where} was recently registered with MSHA. New sites in Wisconsin usually need the full stack before the first load leaves: county reclamation permit, conditional use approval, WPDES coverage and, with a crusher, an air permit.`;
    case "EXPANSION":
      return `I saw ${where} is headed toward an expansion. Growing past the permitted boundary reopens the reclamation plan and bond, and usually the conditional use permit too.`;
    case "REACTIVATION":
      return `I noticed ${where} is showing active again with MSHA. Restarting a pit is a good moment to make sure the reclamation permit, bond and WPDES coverage still match what's on the ground.`;
    default: {
      const needs = topNeeds(c);
      return `I work with Wisconsin ${c.site?.commodityLabel.toLowerCase() ?? "aggregate"} operators on permitting. A site like ${where} typically carries ${list(needs.length ? needs : ["a county reclamation permit", "WPDES coverage"])} — and the paperwork lands on whoever runs the pit.`;
    }
  }
}

export function templateEmail(c: LeadContext, step: SequenceStep): { subject: string; body: string } {
  const name = first(c);
  const needs = topNeeds(c);
  const [lo, hi] = c.timelineWeeks;
  switch (step.intent) {
    case "opener":
      return {
        subject: c.site ? `${c.site.name} permits` : `${c.company.name} permits`,
        body: [
          `Hi ${name},`,
          openerHook(c),
          `We take that whole package off your plate for a flat fee: we draft every application and plan, handle the county and WDNR back-and-forth, and you review and sign.`,
          `Worth a 15-minute call to walk through what your county and WDNR will want for ${c.site?.name ?? "your site"}?`,
        ].join("\n\n"),
      };
    case "specific_permit": {
      const key = c.needs[0];
      const tip =
        key?.key === "NR135_RECLAMATION" || key?.key === "FINANCIAL_ASSURANCE"
          ? "The piece that most often gets sent back is the reclamation cost estimate behind the bond — too low and the county rejects it, too high and you tie up credit for years. Phasing the plan lets you release bond as areas are reclaimed."
          : key?.key === "LOCAL_ZONING"
            ? "Conditional use hearings are won before the meeting: haul routes, hours, berms and dust control spelled out in the application leave neighbors less to object to and the committee less to condition."
            : key?.key === "AIR_PERMIT"
              ? "On the air side, the equipment list and throughput decide which WDNR permit type fits — getting that right up front is the difference between a short general-permit process and a months-long site-specific review."
              : "Most delays come from filing the permits one after another. Run in parallel, the slowest approval sets the start date instead of the sum of all of them.";
      return {
        subject: "",
        body: [`Hi ${name},`, tip, `Happy to share what that would look like for ${c.site?.name ?? "your operation"} if useful.`].join(
          "\n\n",
        ),
      };
    }
    case "timeline_risk":
      return {
        subject: `timing for ${c.site?.name ?? c.company.name}`,
        body: [
          `Hi ${name},`,
          `For a site like ${siteRef(c)}, the permitting path we'd expect runs roughly ${lo}–${hi} weeks end to end${needs.length ? `, with ${needs[0]} as the long pole` : ""}. Filed one at a time it's often twice that — which can mean losing a season.`,
          `Our fixed-fee package runs everything in parallel, so the slowest approval sets your start date, not the sum of them.`,
          `Is this on your radar for this season or next?`,
        ].join("\n\n"),
      };
    case "proof":
      return {
        subject: "",
        body: [
          `Hi ${name},`,
          `To be concrete about what "we handle it" means, the ${c.offer.name} covers: ${list(needs.length ? needs : ["the county reclamation permit", "WPDES coverage"])}, the reclamation plan and bond estimate, a storm water pollution prevention plan, hearing prep if the county wants one, and a 12-month compliance calendar so annual reports and fees don't slip.`,
          `You review and sign; we write, file and chase.`,
          `If you're not the right person for this, who should I talk to?`,
        ].join("\n\n"),
      };
    case "breakup":
      return {
        subject: "",
        body: [
          `Hi ${name},`,
          `I'll stop here so I'm not cluttering your inbox. If it would help, I can send a one-page permit checklist for ${c.site?.name ?? "your site"} — just reply "checklist."`,
        ].join("\n\n"),
      };
    default:
      return { subject: "", body: `Hi ${name},` };
  }
}

/** Human task text for CALL / LINKEDIN steps. */
export function taskText(c: LeadContext, step: SequenceStep): { title: string; detail: string } {
  const who = [c.contact.firstName, c.contact.lastName].filter(Boolean).join(" ") || c.contact.email;
  if (step.channel === "CALL") {
    return {
      title: `Call ${who} (${c.company.name})`,
      detail: `Reference the emails about ${siteRef(c)}. Ask who owns the reclamation permit / WPDES paperwork and whether ${topNeeds(c, 2).join(" or ") || "permits"} are on their plate this season. Goal: book the 15-minute call.`,
    };
  }
  return {
    title: `LinkedIn: connect with ${who} (${c.company.name})`,
    detail: `Note: "Saw ${c.site?.name ?? c.company.name} — we help Wisconsin pits with county and WDNR permitting. Happy to connect."`,
  };
}
