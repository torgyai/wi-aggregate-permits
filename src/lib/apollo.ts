/**
 * Apollo.io REST client (https://docs.apollo.io). Used to find the decision
 * maker at an operator: company lookup -> people search (free, no emails) ->
 * people match (reveals the work email, costs a credit).
 */
const BASE = "https://api.apollo.io/api/v1";

export const apolloEnabled = () => !!process.env.APOLLO_API_KEY;

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": process.env.APOLLO_API_KEY ?? "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type ApolloOrg = { id: string; name: string; primary_domain?: string | null; website_url?: string | null; phone?: string | null };
export type ApolloPerson = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  last_name_obfuscated?: string | null;
  title?: string | null;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
};

/** Titles that sign a $40k permitting engagement at a pit/quarry operator, in priority order. */
export const BUYER_TITLES = [
  "owner",
  "president",
  "ceo",
  "general manager",
  "vice president",
  "operations manager",
  "environmental manager",
  "plant manager",
];

export function titleRank(title: string | null | undefined): number {
  const t = (title ?? "").toLowerCase();
  const i = BUYER_TITLES.findIndex((k) => t.includes(k));
  return i < 0 ? BUYER_TITLES.length : i;
}

export async function findOrganization(name: string, state = "Wisconsin"): Promise<ApolloOrg | null> {
  const r = await call<{ organizations?: ApolloOrg[]; accounts?: (ApolloOrg & { organization_id?: string; domain?: string })[] }>(
    "/mixed_companies/search",
    { q_organization_name: name, organization_locations: [`${state}, US`], per_page: 5, page: 1 },
  );
  const accounts = (r.accounts ?? []).map((a) => ({
    ...a,
    id: a.organization_id ?? a.id,
    primary_domain: a.primary_domain ?? a.domain ?? null,
  }));
  return [...accounts, ...(r.organizations ?? [])][0] ?? null;
}

export async function searchBuyers(orgId: string): Promise<ApolloPerson[]> {
  const r = await call<{ people?: ApolloPerson[] }>("/mixed_people/api_search", {
    organization_ids: [orgId],
    person_titles: BUYER_TITLES,
    per_page: 10,
    page: 1,
  });
  return (r.people ?? []).sort((a, b) => titleRank(a.title) - titleRank(b.title));
}

/** Reveals the work email for a person found by search. Consumes an Apollo credit. */
export async function revealPerson(personId: string): Promise<ApolloPerson | null> {
  const r = await call<{ person?: ApolloPerson }>("/people/match", { id: personId, reveal_personal_emails: false });
  return r.person ?? null;
}
