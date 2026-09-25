// Vercel build: create/update tables when a database is attached, then build.
// Never fails the deploy just because the database isn't connected yet — the
// app then shows /setup explaining what to add.
import { execSync } from "node:child_process";

const pooled = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || pooled;
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

if (direct) {
  try {
    run("npx prisma db push --skip-generate", { DATABASE_URL: direct });
  } catch (err) {
    console.warn("\n⚠️  prisma db push failed — continuing the build. Check the database connection string.\n");
  }
} else {
  console.warn("\n⚠️  No DATABASE_URL: skipping table creation. Connect Postgres in Vercel → Storage and redeploy.\n");
}
run("npx next build");
