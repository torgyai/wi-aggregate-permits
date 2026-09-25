/**
 * Environment resolution with the fallbacks Vercel storage integrations use
 * (Neon sets DATABASE_URL / DATABASE_URL_UNPOOLED; Vercel Postgres sets POSTGRES_*).
 */
export const databaseUrl = () =>
  process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || "";

/** What's missing for the app to work — shown on /setup (booleans only, never values). */
export function configProblems(): string[] {
  const out: string[] = [];
  if (!databaseUrl()) out.push("DATABASE_URL — connect a Postgres database (Vercel → Storage → Neon) and redeploy.");
  if (!process.env.AUTH_SECRET) out.push("AUTH_SECRET — long random string (signs your login session).");
  if (!process.env.ADMIN_EMAIL) out.push("ADMIN_EMAIL — the email you log in with.");
  if (!process.env.ADMIN_PASSWORD) out.push("ADMIN_PASSWORD — the password you log in with.");
  return out;
}
